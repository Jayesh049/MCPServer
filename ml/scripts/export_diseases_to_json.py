"""
Export disease rows from Postgres (Prisma tables) to ml/diseases/{slug}.json.

Run from repo root after ETL:
  python ml/scripts/export_diseases_to_json.py

Requires DATABASE_URL in .env (same as fetch_and_insert.py).
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

REPO_ROOT = Path(__file__).resolve().parents[2]
ML_ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ML_ROOT / "config" / "diseases.json"
OUT_DIR = ML_ROOT / "diseases"


def find_dotenv() -> Path | None:
    for p in [REPO_ROOT, REPO_ROOT.parent]:
        cand = p / ".env"
        if cand.is_file():
            return cand
    return None


def load_slugs() -> list[str]:
    data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return [d["slug"] for d in data["diseases"]]


def json_safe(obj: Any) -> Any:
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [json_safe(v) for v in obj]
    return obj


def row_dict(row: dict[str, Any]) -> dict[str, Any]:
    return json_safe(dict(row))


def main() -> None:
    env = find_dotenv()
    if env:
        load_dotenv(env)
    else:
        load_dotenv()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL not set.", file=sys.stderr)
        sys.exit(1)

    slugs = load_slugs()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with psycopg.connect(dsn, row_factory=dict_row) as conn:
        for slug in slugs:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT * FROM "DiseaseWebInfo" WHERE "slug" = %s',
                    (slug,),
                )
                web = cur.fetchone()

                cur.execute(
                    'SELECT * FROM "DiseaseSpecialistInfo" WHERE "diseaseSlug" = %s ORDER BY "createdAt"',
                    (slug,),
                )
                specialists = [row_dict(r) for r in cur.fetchall()]

                cur.execute(
                    'SELECT * FROM "DiseaseYogaPranayamInfo" WHERE "diseaseSlug" = %s ORDER BY "createdAt"',
                    (slug,),
                )
                yoga = [row_dict(r) for r in cur.fetchall()]

                cur.execute(
                    'SELECT * FROM "DiseaseCriticalityProfile" WHERE "diseaseSlug" = %s',
                    (slug,),
                )
                crit = cur.fetchone()

            payload = {
                "slug": slug,
                "webInfo": row_dict(web) if web else None,
                "specialists": specialists,
                "yogaPranayam": yoga,
                "criticality": row_dict(crit) if crit else None,
            }
            out_path = OUT_DIR / f"{slug}.json"
            out_path.write_text(
                json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            print(f"Wrote {out_path.relative_to(REPO_ROOT)}", flush=True)

        index = {
            "slugs": slugs,
            "count": len(slugs),
            "source": "Postgres Prisma disease knowledge tables",
        }
        (OUT_DIR / "index.json").write_text(
            json.dumps(index, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"Wrote {OUT_DIR.relative_to(REPO_ROOT) / 'index.json'}", flush=True)


if __name__ == "__main__":
    main()
