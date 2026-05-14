#!/usr/bin/env python3
"""
Generate ml/diseases/<slug>/model.py + controller.py for each disease in ml/config/diseases.json.
Re-run after editing diseases.json to refresh constants (idempotent overwrite).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ML_ROOT.parent
CONFIG = ML_ROOT / "config" / "diseases.json"
DISEASES_DIR = ML_ROOT / "diseases"


def model_py(slug: str, display_name: str, category: str, modality: str) -> str:
    return f'''\
"""
Disease corpus ML metadata for `{slug}`.
Training/ingest use the shared Flask app (`ml/flask_disease/`); rows live in Postgres.
"""

SLUG = {json.dumps(slug)}
DISPLAY_NAME = {json.dumps(display_name)}
CATEGORY = {json.dumps(category)}
MODALITY = {json.dumps(modality)}

# Default sklearn pipeline key for `DiseaseFunctionalityConfig.formulaKey` (override in DB).
DEFAULT_FORMULA_KEY = "tfidf_lr"
# Default RAG/corpus functionality bucket for this disease.
DEFAULT_FUNCTIONALITY = "educational_triage_text"


def spec_dict() -> dict:
    return {{
        "slug": SLUG,
        "displayName": DISPLAY_NAME,
        "category": CATEGORY,
        "modality": MODALITY,
        "defaultFunctionality": DEFAULT_FUNCTIONALITY,
        "defaultFormulaKey": DEFAULT_FORMULA_KEY,
        "sharedEndpoints": {{
            "ingest": f"POST /v1/diseases/{{SLUG}}/assets",
            "train": f"POST /v1/diseases/{{SLUG}}/train",
            "models": f"GET /v1/diseases/{{SLUG}}/models",
            "predict": f"POST /v1/diseases/{{SLUG}}/predict",
        }},
    }}
'''


CTRL_PY = '''\
"""
Per-disease controller: metadata routes only.
Shared ingest/train/predict are implemented in `ml/flask_disease/app/controllers/diseases.py`.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

_dir = Path(__file__).resolve().parent
_mod_name = "disease_model_" + _dir.name.replace("-", "_")
_spec = importlib.util.spec_from_file_location(_mod_name, _dir / "model.py")
assert _spec and _spec.loader
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

from flask import Blueprint, jsonify

blueprint = Blueprint(
    "disease_spec_" + _dir.name.replace("-", "_"),
    __name__,
    url_prefix="/v1/diseases/" + _mod.SLUG,
)


@blueprint.get("/corpus-spec")
def corpus_spec():
    """JSON describing defaults for this disease (MCP/Flask clients can read before train)."""
    return jsonify(_mod.spec_dict())
'''


def main() -> None:
    data = json.loads(CONFIG.read_text(encoding="utf-8"))
    diseases = data.get("diseases") or []
    if not diseases:
        print("No diseases in config.", file=sys.stderr)
        sys.exit(1)

    DISEASES_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    for d in diseases:
        slug = d["slug"]
        display = d.get("displayName") or slug
        category = d.get("category") or "unknown"
        modality = d.get("modality") or "unknown"
        out_dir = DISEASES_DIR / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "__init__.py").write_text(
            f'"""Package for disease slug `{slug}` (model + controller stubs)."""\n',
            encoding="utf-8",
        )
        (out_dir / "model.py").write_text(model_py(slug, display, category, modality), encoding="utf-8")
        (out_dir / "controller.py").write_text(CTRL_PY, encoding="utf-8")
        written += 1
        print("OK", slug)

    print(f"Wrote {written} disease folders under {DISEASES_DIR.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
