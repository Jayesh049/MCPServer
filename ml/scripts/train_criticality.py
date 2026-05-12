"""
Demo regressor: predict heuristic criticalityPercent from Wikipedia summary + registry modality.

Run after ETL: python ml/scripts/train_criticality.py
Writes ml/artifacts/criticality_model.joblib and metrics.json (gitignored dir).
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import joblib
import pandas as pd
import psycopg
from dotenv import load_dotenv
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

REPO_ROOT = Path(__file__).resolve().parents[2]
ML_ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ML_ROOT / "config" / "diseases.json"
ART_DIR = ML_ROOT / "artifacts"


def load_registry_meta() -> dict[str, dict]:
    data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return {d["slug"]: d for d in data["diseases"]}


def main() -> None:
    env = REPO_ROOT / ".env"
    if env.is_file():
        load_dotenv(env)
    else:
        load_dotenv()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    reg = load_registry_meta()
    sql = """
      SELECT w."slug", w."summary", c."criticalityPercent"
      FROM "DiseaseWebInfo" w
      INNER JOIN "DiseaseCriticalityProfile" c ON w."slug" = c."diseaseSlug"
    """
    rows: list[dict] = []
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            for slug, summary, pct in cur.fetchall():
                m = reg.get(slug)
                if not m or summary is None:
                    continue
                rows.append(
                    {
                        "slug": slug,
                        "summary": summary or "",
                        "category": m.get("category", "unknown"),
                        "modality": m.get("modality", "unknown"),
                        "y": float(pct),
                    }
                )

    if len(rows) < 4:
        print(
            f"Need at least 4 joined rows; found {len(rows)}. Run fetch_and_insert.py first.",
            file=sys.stderr,
        )
        sys.exit(1)

    df = pd.DataFrame(rows)
    ART_DIR.mkdir(parents=True, exist_ok=True)

    X = df[["summary", "category", "modality"]]
    y = df["y"]

    if len(df) >= 10:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.25, random_state=42
        )
    else:
        X_train, X_test, y_train, y_test = X, X, y, y

    pre = ColumnTransformer(
        transformers=[
            (
                "tfidf",
                TfidfVectorizer(max_features=120, stop_words="english"),
                "summary",
            ),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                ["category", "modality"],
            ),
        ]
    )
    model = Pipeline(
        steps=[
            ("pre", pre),
            (
                "rf",
                RandomForestRegressor(
                    n_estimators=80,
                    max_depth=8,
                    random_state=42,
                ),
            ),
        ]
    )
    model.fit(X_train, y_train)
    pred_train = model.predict(X_train)
    pred_test = model.predict(X_test)
    metrics = {
        "n_samples": len(df),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "train_mae": float(mean_absolute_error(y_train, pred_train)),
        "test_mae": float(mean_absolute_error(y_test, pred_test)),
        "train_r2": float(r2_score(y_train, pred_train)),
        "test_r2": float(r2_score(y_test, pred_test)),
        "note": "Labels are heuristic scores from ETL — demo only, not clinical validation.",
    }

    joblib.dump(model, ART_DIR / "criticality_model.joblib")
    (ART_DIR / "metrics.json").write_text(
        json.dumps(metrics, indent=2), encoding="utf-8"
    )
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
