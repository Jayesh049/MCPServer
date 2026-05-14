from __future__ import annotations

from flask import jsonify, request

from .config import disease_ml_secret


def require_disease_ml_key():
    """If DISEASE_ML_SECRET is set, require matching X-Disease-Ml-Key header."""
    secret = disease_ml_secret()
    if not secret:
        return None
    if request.headers.get("X-Disease-Ml-Key", "") != secret:
        return jsonify({"error": "Unauthorized", "hint": "Send X-Disease-Ml-Key matching DISEASE_ML_SECRET."}), 401
    return None
