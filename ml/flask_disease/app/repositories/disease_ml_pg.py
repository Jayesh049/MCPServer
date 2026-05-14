from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone
from typing import Any

import psycopg


def _new_id() -> str:
    return secrets.token_hex(12)


def count_assets(conn: psycopg.Connection, disease_slug: str, functionality: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)::int FROM "DiseaseTrainingAsset"
            WHERE "diseaseSlug" = %s AND "functionality" = %s
            """,
            (disease_slug, functionality),
        )
        row = cur.fetchone()
        return int(row[0]) if row else 0


def insert_asset(
    conn: psycopg.Connection,
    *,
    disease_slug: str,
    functionality: str,
    kind: str,
    mime_type: str,
    sha256: str,
    storage_key: str,
    extracted_text: str | None,
    training_label: int | None,
    meta: dict[str, Any] | None,
) -> str:
    aid = _new_id()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "DiseaseTrainingAsset"
            ("id", "diseaseSlug", "functionality", "kind", "mimeType", "sha256", "storageKey",
             "extractedText", "trainingLabel", "meta", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s::"DiseaseTrainingAssetKind", %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT ("diseaseSlug", "functionality", "sha256") DO UPDATE SET
              "mimeType" = EXCLUDED."mimeType",
              "storageKey" = EXCLUDED."storageKey",
              "extractedText" = EXCLUDED."extractedText",
              "trainingLabel" = EXCLUDED."trainingLabel",
              "meta" = EXCLUDED."meta",
              "updatedAt" = EXCLUDED."updatedAt"
            RETURNING "id"
            """,
            (
                aid,
                disease_slug,
                functionality,
                kind,
                mime_type,
                sha256,
                storage_key,
                extracted_text,
                training_label,
                json.dumps(meta) if meta is not None else None,
                now,
                now,
            ),
        )
        rid = cur.fetchone()[0]
    return str(rid)


def get_config(conn: psycopg.Connection, disease_slug: str, functionality: str) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT "id", "diseaseSlug", "functionality", "formulaKey", "hyperparams", "isActive"
            FROM "DiseaseFunctionalityConfig"
            WHERE "diseaseSlug" = %s AND "functionality" = %s AND "isActive" = true
            LIMIT 1
            """,
            (disease_slug, functionality),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "id": row[0],
            "diseaseSlug": row[1],
            "functionality": row[2],
            "formulaKey": row[3],
            "hyperparams": row[4] if isinstance(row[4], dict) else (json.loads(row[4]) if row[4] else None),
            "isActive": row[5],
        }


def upsert_config(
    conn: psycopg.Connection,
    *,
    disease_slug: str,
    functionality: str,
    formula_key: str,
    hyperparams: dict[str, Any] | None,
) -> str:
    cid = _new_id()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "DiseaseFunctionalityConfig"
            ("id", "diseaseSlug", "functionality", "formulaKey", "hyperparams", "isActive", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, true, %s, %s)
            ON CONFLICT ("diseaseSlug", "functionality") DO UPDATE SET
              "formulaKey" = EXCLUDED."formulaKey",
              "hyperparams" = EXCLUDED."hyperparams",
              "isActive" = true,
              "updatedAt" = EXCLUDED."updatedAt"
            RETURNING "id"
            """,
            (
                cid,
                disease_slug,
                functionality,
                formula_key,
                json.dumps(hyperparams) if hyperparams else None,
                now,
                now,
            ),
        )
        out = str(cur.fetchone()[0])
    return out


def list_training_texts(conn: psycopg.Connection, disease_slug: str, functionality: str) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT "id", "extractedText", "trainingLabel"
            FROM "DiseaseTrainingAsset"
            WHERE "diseaseSlug" = %s AND "functionality" = %s
              AND "extractedText" IS NOT NULL AND length(trim("extractedText")) > 0
            """,
            (disease_slug, functionality),
        )
        rows = cur.fetchall()
    return [{"id": r[0], "text": r[1], "trainingLabel": r[2]} for r in rows]


def next_model_version(conn: psycopg.Connection, config_id: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT COALESCE(MAX("version"), 0) + 1 FROM "DiseaseTrainedModel" WHERE "configId" = %s',
            (config_id,),
        )
        return int(cur.fetchone()[0])


def insert_trained_model(
    conn: psycopg.Connection,
    *,
    model_id: str,
    config_id: str,
    version: int,
    artifact_storage_key: str,
    metrics: dict[str, Any],
    n_samples: int,
) -> str:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "DiseaseTrainedModel"
            ("id", "configId", "version", "artifactStorageKey", "metrics", "trainedAt", "nSamples")
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                model_id,
                config_id,
                version,
                artifact_storage_key,
                json.dumps(metrics),
                now,
                n_samples,
            ),
        )
    return model_id


def list_models(conn: psycopg.Connection, disease_slug: str, functionality: str) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT m."id", m."version", m."artifactStorageKey", m."metrics", m."trainedAt", m."nSamples",
                   c."formulaKey"
            FROM "DiseaseTrainedModel" m
            INNER JOIN "DiseaseFunctionalityConfig" c ON c."id" = m."configId"
            WHERE c."diseaseSlug" = %s AND c."functionality" = %s
            ORDER BY m."trainedAt" DESC
            LIMIT 20
            """,
            (disease_slug, functionality),
        )
        rows = cur.fetchall()
    out = []
    for r in rows:
        out.append(
            {
                "id": r[0],
                "version": r[1],
                "artifactStorageKey": r[2],
                "metrics": r[3],
                "trainedAt": r[4].isoformat() if r[4] else None,
                "nSamples": r[5],
                "formulaKey": r[6],
            }
        )
    return out


def get_latest_model_row(conn: psycopg.Connection, disease_slug: str, functionality: str) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT m."id", m."artifactStorageKey", m."metrics", c."formulaKey", c."hyperparams"
            FROM "DiseaseTrainedModel" m
            INNER JOIN "DiseaseFunctionalityConfig" c ON c."id" = m."configId"
            WHERE c."diseaseSlug" = %s AND c."functionality" = %s
            ORDER BY m."trainedAt" DESC
            LIMIT 1
            """,
            (disease_slug, functionality),
        )
        row = cur.fetchone()
        if not row:
            return None
        hp = row[4]
        if hp is not None and not isinstance(hp, dict):
            hp = json.loads(hp)
        return {
            "id": row[0],
            "artifactStorageKey": row[1],
            "metrics": row[2],
            "formulaKey": row[3],
            "hyperparams": hp,
        }
