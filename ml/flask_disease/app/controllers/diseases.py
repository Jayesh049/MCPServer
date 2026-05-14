from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..auth import require_disease_ml_key
from ..services import disease_ops

diseases_bp = Blueprint("diseases", __name__)


@diseases_bp.before_request
def _require_secret() -> tuple | None:
    return require_disease_ml_key()


@diseases_bp.route("/<slug>/assets", methods=["POST"])
def post_assets(slug: str):
    functionality = (
        request.form.get("functionality") or "educational_triage_text"
    ).strip()
    if not functionality:
        return jsonify({"ok": False, "error": "functionality cannot be empty"}), 400

    files_payload: list[tuple[str, str, bytes, int | None]] = []
    label_raw = request.form.get("trainingLabel")
    default_label: int | None = None
    if label_raw is not None and str(label_raw).strip() != "":
        try:
            default_label = int(label_raw)
            if default_label not in (0, 1):
                return jsonify({"ok": False, "error": "trainingLabel must be 0 or 1"}), 400
        except ValueError:
            return jsonify({"ok": False, "error": "trainingLabel must be an integer"}), 400

    uploaded = request.files.getlist("file")
    if not uploaded:
        f = request.files.get("files")
        if f and f.filename:
            uploaded = [f]
    if not uploaded:
        return jsonify({"ok": False, "error": "No file(s). Use multipart field name 'file'."}), 400

    for f in uploaded:
        if not f or not f.filename:
            continue
        data = f.read()
        files_payload.append((f.filename, f.mimetype or "application/octet-stream", data, default_label))

    if not files_payload:
        return jsonify({"ok": False, "error": "Empty upload."}), 400

    out = disease_ops.ingest_files(
        disease_slug=slug, functionality=functionality, files=files_payload
    )
    if not out.get("ok"):
        return jsonify(out), 400
    return jsonify(out)


@diseases_bp.route("/<slug>/train", methods=["POST"])
def post_train(slug: str):
    body = request.get_json(silent=True) or {}
    functionality = str(body.get("functionality") or "educational_triage_text").strip()
    formula_key = body.get("formulaKey")
    fk = str(formula_key).strip() if formula_key else None
    hyper = body.get("hyperparams")
    hp = hyper if isinstance(hyper, dict) else None

    out = disease_ops.train_for_slug(
        disease_slug=slug,
        functionality=functionality,
        formula_key=fk,
        hyperparams=hp,
    )
    if not out.get("ok"):
        return jsonify(out), 400
    return jsonify(out)


@diseases_bp.route("/<slug>/models", methods=["GET"])
def get_models(slug: str):
    functionality = (request.args.get("functionality") or "educational_triage_text").strip()
    out = disease_ops.list_models(slug, functionality)
    return jsonify(out)


@diseases_bp.route("/<slug>/predict", methods=["POST"])
def post_predict(slug: str):
    body = request.get_json(silent=True) or {}
    functionality = str(body.get("functionality") or "educational_triage_text").strip()
    text = str(body.get("text") or "").strip()
    out = disease_ops.predict_text(disease_slug=slug, functionality=functionality, text=text)
    if not out.get("ok"):
        return jsonify(out), 400
    return jsonify(out)
