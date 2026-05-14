from __future__ import annotations

import hashlib
import io
import json
import secrets
from typing import Any

import joblib
import psycopg
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split

from ..config import database_url, max_assets_per_slug
from ..formulas import build_pipeline
from ..repositories import disease_ml_pg as repo
from .extract import extract_pdf_text, placeholder_image_text
from .storage import load_bytes, save_artifact_local_or_s3, save_bytes


def _normalize_hyperparams(h: dict[str, Any] | None) -> dict[str, Any] | None:
    if not h:
        return h
    out: dict[str, Any] = json.loads(json.dumps(h))

    def fix_vec(d: dict[str, Any]) -> None:
        ng = d.get("ngram_range")
        if isinstance(ng, list) and len(ng) == 2:
            d["ngram_range"] = (int(ng[0]), int(ng[1]))

    if isinstance(out.get("vectorizer"), dict):
        fix_vec(out["vectorizer"])
    else:
        fix_vec(out)
    return out


def ingest_files(
    *,
    disease_slug: str,
    functionality: str,
    files: list[tuple[str, str, bytes, int | None]],
) -> dict[str, Any]:
    """files: (filename, mime_type, data, optional_training_label 0|1)."""
    results: list[dict[str, Any]] = []
    errors: list[str] = []

    with psycopg.connect(database_url()) as conn:
        n = repo.count_assets(conn, disease_slug, functionality)

        for filename, mime, data, label_from_tuple in files:
            if n >= max_assets_per_slug():
                errors.append(f"Skipped {filename}: max assets ({max_assets_per_slug()}) reached.")
                break

            mime_l = (mime or "").split(";")[0].strip().lower()
            if mime_l not in ("application/pdf", "image/jpeg", "image/png", "image/webp"):
                errors.append(f"Rejected {filename}: unsupported mime {mime_l!r}.")
                continue

            kind = "PDF" if mime_l == "application/pdf" else "IMAGE"
            sha = hashlib.sha256(data).hexdigest()
            ext = (
                ".pdf"
                if kind == "PDF"
                else (
                    ".jpg"
                    if mime_l == "image/jpeg"
                    else ".png" if mime_l == "image/png" else ".webp"
                )
            )

            try:
                sk = save_bytes(data=data, disease_slug=disease_slug, sha256=sha, original_ext=ext)
            except Exception as e:
                errors.append(f"{filename}: storage failed: {e}")
                continue

            if kind == "PDF":
                try:
                    extracted = extract_pdf_text(data)
                except Exception as e:
                    extracted = ""
                    errors.append(f"{filename}: PDF extract failed: {e}")
            else:
                extracted = placeholder_image_text()

            tl = label_from_tuple
            if tl is not None and tl not in (0, 1):
                errors.append(f"{filename}: trainingLabel must be 0 or 1; ignored.")
                tl = None

            try:
                aid = repo.insert_asset(
                    conn,
                    disease_slug=disease_slug,
                    functionality=functionality,
                    kind=kind,
                    mime_type=mime_l,
                    sha256=sha,
                    storage_key=sk,
                    extracted_text=extracted or None,
                    training_label=tl,
                    meta={"originalFilename": filename},
                )
            except Exception as e:
                errors.append(f"{filename}: DB insert failed: {e}")
                continue

            n += 1
            results.append(
                {
                    "id": aid,
                    "filename": filename,
                    "sha256": sha,
                    "kind": kind,
                    "storageKey": sk,
                    "extractedChars": len(extracted or ""),
                }
            )

        conn.commit()

    return {
        "ok": True,
        "diseaseSlug": disease_slug,
        "functionality": functionality,
        "ingested": results,
        "warnings": errors,
        "disclaimer": "Educational demo only — not for clinical decisions.",
    }


def train_for_slug(
    *,
    disease_slug: str,
    functionality: str,
    formula_key: str | None = None,
    hyperparams: dict[str, Any] | None = None,
) -> dict[str, Any]:
    with psycopg.connect(database_url()) as conn:
        cfg = repo.get_config(conn, disease_slug, functionality)
        if cfg is None:
            if not formula_key:
                return {
                    "ok": False,
                    "error": "No DiseaseFunctionalityConfig for this slug/functionality. "
                    "Pass formulaKey in the request body to create one, or seed the DB.",
                }
            repo.upsert_config(
                conn,
                disease_slug=disease_slug,
                functionality=functionality,
                formula_key=formula_key,
                hyperparams=hyperparams,
            )
            cfg = repo.get_config(conn, disease_slug, functionality)
            if not cfg:
                return {"ok": False, "error": "Failed to create config row."}
        elif formula_key and formula_key != cfg["formulaKey"]:
            repo.upsert_config(
                conn,
                disease_slug=disease_slug,
                functionality=functionality,
                formula_key=formula_key,
                hyperparams=hyperparams if hyperparams is not None else cfg.get("hyperparams"),
            )
            cfg = repo.get_config(conn, disease_slug, functionality)
        elif hyperparams is not None:
            repo.upsert_config(
                conn,
                disease_slug=disease_slug,
                functionality=functionality,
                formula_key=cfg["formulaKey"],
                hyperparams=hyperparams,
            )
            cfg = repo.get_config(conn, disease_slug, functionality)

        assert cfg is not None
        rows = repo.list_training_texts(conn, disease_slug, functionality)
        if len(rows) < 2:
            return {
                "ok": False,
                "error": "Need at least 2 assets with non-empty extractedText. Ingest PDFs first.",
                "nRows": len(rows),
            }

        texts = [r["text"] or "" for r in rows]
        labels: list[int] = []
        for r in rows:
            if r.get("trainingLabel") is not None and int(r["trainingLabel"]) in (0, 1):
                labels.append(int(r["trainingLabel"]))
            else:
                h = hashlib.sha256((r["text"] or "").encode()).digest()[0] % 2
                labels.append(int(h))

        hp = _normalize_hyperparams(cfg.get("hyperparams"))
        pipe = build_pipeline(cfg["formulaKey"], hp)

        metrics: dict[str, Any] = {"nSamples": len(texts), "formulaKey": cfg["formulaKey"]}
        if len(texts) >= 6:
            try:
                X_train, X_test, y_train, y_test = train_test_split(
                    texts, labels, test_size=0.25, random_state=42, stratify=labels
                )
            except ValueError:
                X_train, X_test, y_train, y_test = train_test_split(
                    texts, labels, test_size=0.25, random_state=42
                )
            pipe.fit(X_train, y_train)
            pred = pipe.predict(X_test)
            metrics["accuracy"] = float(accuracy_score(y_test, pred))
            metrics["f1"] = float(f1_score(y_test, pred, average="binary", zero_division=0))
        else:
            pipe.fit(texts, labels)
            pred = pipe.predict(texts)
            metrics["accuracy"] = float(accuracy_score(labels, pred))
            metrics["f1"] = float(f1_score(labels, pred, average="binary", zero_division=0))
            metrics["note"] = "Small sample: metrics on training set only."

        buf = io.BytesIO()
        joblib.dump(pipe, buf)
        blob = buf.getvalue()

        version = repo.next_model_version(conn, cfg["id"])
        model_id = secrets.token_hex(12)
        try:
            artifact_key = save_artifact_local_or_s3(
                data=blob,
                disease_slug=disease_slug,
                functionality=functionality,
                model_id=model_id,
            )
        except Exception as e:
            conn.rollback()
            return {"ok": False, "error": f"Artifact storage failed: {e}"}

        repo.insert_trained_model(
            conn,
            model_id=model_id,
            config_id=cfg["id"],
            version=version,
            artifact_storage_key=artifact_key,
            metrics=metrics,
            n_samples=len(texts),
        )
        conn.commit()

    return {
        "ok": True,
        "diseaseSlug": disease_slug,
        "functionality": functionality,
        "modelId": model_id,
        "version": version,
        "artifactStorageKey": artifact_key,
        "metrics": metrics,
        "disclaimer": "Educational demo only — pseudo-labels used when trainingLabel is unset.",
    }


def list_models(disease_slug: str, functionality: str) -> dict[str, Any]:
    with psycopg.connect(database_url()) as conn:
        rows = repo.list_models(conn, disease_slug, functionality)
    return {
        "ok": True,
        "diseaseSlug": disease_slug,
        "functionality": functionality,
        "models": rows,
    }


def predict_text(
    *, disease_slug: str, functionality: str, text: str
) -> dict[str, Any]:
    text = (text or "").strip()
    if not text:
        return {"ok": False, "error": "text is required"}

    with psycopg.connect(database_url()) as conn:
        row = repo.get_latest_model_row(conn, disease_slug, functionality)
    if not row:
        return {"ok": False, "error": "No trained model for this slug/functionality."}

    raw = load_bytes(row["artifactStorageKey"])
    pipe = joblib.loads(raw)
    pred = pipe.predict([text])
    label = int(pred[0])
    out: dict[str, Any] = {
        "ok": True,
        "diseaseSlug": disease_slug,
        "functionality": functionality,
        "predictedClass": label,
        "formulaKey": row["formulaKey"],
        "disclaimer": "Educational demo only — not for clinical decisions.",
    }
    if hasattr(pipe, "predict_proba"):
        try:
            proba = pipe.predict_proba([text])[0]
            out["probabilities"] = [float(x) for x in proba.tolist()]
        except Exception:
            pass
    else:
        try:
            df = pipe.decision_function([text])
            out["decisionFunction"] = float(df[0])
        except Exception:
            pass
    return out
