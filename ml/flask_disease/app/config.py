from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_loaded = False


def load_config() -> None:
    global _loaded
    if _loaded:
        return
    _loaded = True
    root = Path(__file__).resolve().parents[3]
    env = root / ".env"
    if env.is_file():
        load_dotenv(env)
    else:
        load_dotenv()


def database_url() -> str:
    u = os.environ.get("DATABASE_URL", "").strip()
    if not u:
        raise RuntimeError("DATABASE_URL is required")
    return u


def disease_ml_secret() -> str | None:
    s = os.environ.get("DISEASE_ML_SECRET", "").strip()
    return s or None


def storage_kind() -> str:
    return os.environ.get("DISEASE_ML_STORAGE", "local").strip().lower()


def storage_root() -> Path:
    root = os.environ.get("DISEASE_ML_STORAGE_ROOT", "").strip()
    if root:
        return Path(root)
    return Path(__file__).resolve().parents[2] / "artifacts" / "disease_ml"


def s3_bucket() -> str | None:
    b = os.environ.get("DISEASE_ML_S3_BUCKET", "").strip()
    return b or None


def s3_prefix() -> str:
    return os.environ.get("DISEASE_ML_S3_PREFIX", "disease-ml").strip().rstrip("/")


def max_assets_per_slug() -> int:
    return int(os.environ.get("DISEASE_ML_MAX_ASSETS", "100"))
