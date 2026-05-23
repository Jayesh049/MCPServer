#!/usr/bin/env python3
"""
Train sklearn image classifiers (HOG + histogram features) per imaging disease slug.

Prerequisites:
  pip install -r ml/requirements-imaging.txt
  python ml/scripts/download_imaging_datasets.py

Usage:
  python ml/scripts/train_imaging_classifier.py
  python ml/scripts/train_imaging_classifier.py --slug brain-tumor

Writes:
  ml/artifacts/imaging/<slug>/pipeline.joblib
  src/diseases/models/imaging/<slug>-meta.json
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from imaging_common import REPO, build_matrix, list_images, load_config, disease_dir

ART_ROOT = REPO / "ml" / "artifacts" / "imaging"
META_ROOT = REPO / "src" / "diseases" / "models" / "imaging"
MIN_SAMPLES_PER_CLASS = 6
MIN_TOTAL = 16


def train_one(slug: str, size: int) -> dict | None:
    cfg = load_config()
    disease = next((d for d in cfg["diseases"] if d["slug"] == slug), None)
    if not disease:
        print(f"Unknown slug: {slug}", file=sys.stderr)
        return None

    X, y, paths = build_matrix(slug, size=size)
    n_pos = int((y == 1).sum())
    n_neg = int((y == 0).sum())
    print(f"\n[{slug}] samples={len(y)} pos={n_pos} neg={n_neg}")

    if len(y) < MIN_TOTAL or n_pos < MIN_SAMPLES_PER_CLASS or n_neg < MIN_SAMPLES_PER_CLASS:
        print(
            f"  SKIP: need >={MIN_TOTAL} total and >={MIN_SAMPLES_PER_CLASS} per class. "
            f"Run: python ml/scripts/download_imaging_datasets.py --slug {slug}",
            file=sys.stderr,
        )
        return None

    candidates: list[tuple[str, Pipeline]] = [
        (
            "hog_lr",
            Pipeline(
                [
                    ("scaler", StandardScaler()),
                    (
                        "clf",
                        LogisticRegression(
                            max_iter=3000,
                            class_weight="balanced",
                            random_state=42,
                        ),
                    ),
                ]
            ),
        ),
        (
            "hog_rf",
            Pipeline(
                [
                    ("scaler", StandardScaler()),
                    (
                        "clf",
                        RandomForestClassifier(
                            n_estimators=120,
                            max_depth=12,
                            class_weight="balanced",
                            random_state=42,
                            n_jobs=1,
                        ),
                    ),
                ]
            ),
        ),
    ]

    best_key = ""
    best_pipe: Pipeline | None = None
    best_auc = -1.0
    metrics: dict = {}

    n_splits = min(10, n_pos, n_neg)
    if n_splits < 2:
        n_splits = 2
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)

    for key, pipe in candidates:
        try:
            if len(y) >= 20:
                proba = cross_val_predict(pipe, X, y, cv=cv, method="predict_proba")[:, 1]
                auc = float(roc_auc_score(y, proba))
            else:
                pipe.fit(X, y)
                proba = pipe.predict_proba(X)[:, 1]
                auc = float(roc_auc_score(y, proba))
        except Exception as e:
            print(f"  {key} CV failed: {e}")
            continue
        if auc > best_auc:
            best_auc = auc
            best_key = key
            best_pipe = pipe

    if best_pipe is None:
        print("  No model trained.", file=sys.stderr)
        return None

    if len(y) >= 24:
        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
    else:
        X_tr, X_te, y_tr, y_te = X, X, y, y

    best_pipe.fit(X_tr, y_tr)
    y_pred = best_pipe.predict(X_te)
    proba_te = best_pipe.predict_proba(X_te)[:, 1]

    metrics = {
        "cvAuc": round(best_auc, 4),
        "cvFolds": n_splits,
        "formulaKey": best_key,
        "testAccuracy": round(float(accuracy_score(y_te, y_pred)), 4),
        "testF1": round(float(f1_score(y_te, y_pred, zero_division=0)), 4),
        "nSamples": int(len(y)),
        "nPositive": n_pos,
        "nNegative": n_neg,
        "featureDim": int(X.shape[1]),
        "imageSize": size,
    }

    art_dir = ART_ROOT / slug
    art_dir.mkdir(parents=True, exist_ok=True)
    pipe_path = art_dir / "pipeline.joblib"
    bundle = {
        "pipeline": best_pipe,
        "slug": slug,
        "positiveLabel": disease["positiveLabel"],
        "negativeLabel": disease["negativeLabel"],
        "imageSize": size,
    }
    joblib.dump(bundle, pipe_path)

    META_ROOT.mkdir(parents=True, exist_ok=True)
    meta = {
        "diseaseSlug": slug,
        "displayName": disease.get("displayName", slug),
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "methodology": {
            "features": "RGB histogram + gradient bins + 8x8 gray + stats (Pillow/numpy)",
            "classifiers": ["LogisticRegression", "RandomForest"],
            "selection": "best stratified CV ROC-AUC",
        },
        "metrics": metrics,
        "artifactPath": str(pipe_path.relative_to(REPO)).replace("\\", "/"),
        "dataDirs": {
            "positive": str(disease_dir(slug, "positive").relative_to(REPO)).replace("\\", "/"),
            "negative": str(disease_dir(slug, "negative").relative_to(REPO)).replace("\\", "/"),
        },
    }
    meta_path = META_ROOT / f"{slug}-meta.json"
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"  saved {pipe_path}")
    print(f"  CV AUC={best_auc:.4f} test_acc={metrics['testAccuracy']} key={best_key}")
    return meta


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", default="all")
    parser.add_argument("--skip", default="", help="Comma-separated slugs to skip")
    args = parser.parse_args()

    cfg = load_config()
    size = int(cfg.get("imageSize", 128))
    skip = {s.strip() for s in args.skip.split(",") if s.strip()}
    slugs = [d["slug"] for d in cfg["diseases"]] if args.slug == "all" else [args.slug]
    slugs = [s for s in slugs if s not in skip]

    results: dict[str, object] = {}
    ok = 0
    for slug in slugs:
        meta = train_one(slug, size)
        if meta:
            results[slug] = meta
            ok += 1
        else:
            results[slug] = {"error": "insufficient_data_or_train_failed"}

    summary_path = ART_ROOT / "train_summary.json"
    ART_ROOT.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nTrained {ok}/{len(slugs)} models. Summary: {summary_path}")

    if ok == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
