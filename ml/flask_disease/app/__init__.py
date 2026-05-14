from __future__ import annotations

import os

from flask import Flask

from .config import load_config
from .controllers.health import health_bp
from .controllers.diseases import diseases_bp
from .disease_packages import register_per_disease_blueprints


def create_app() -> Flask:
    load_config()
    app = Flask(__name__)
    max_mb = int(os.environ.get("DISEASE_ML_MAX_UPLOAD_MB", "32"))
    app.config["MAX_CONTENT_LENGTH"] = max_mb * 1024 * 1024

    app.register_blueprint(health_bp)
    app.register_blueprint(diseases_bp, url_prefix="/v1/diseases")
    register_per_disease_blueprints(app)

    return app
