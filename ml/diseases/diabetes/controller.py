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
