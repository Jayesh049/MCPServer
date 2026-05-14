from __future__ import annotations

import io

from ..config import s3_bucket, s3_prefix, storage_kind, storage_root


def build_object_key(disease_slug: str, sha256: str, suffix: str) -> str:
    p = s3_prefix()
    return f"{p}/assets/{disease_slug}/{sha256}{suffix}"


def build_artifact_key(disease_slug: str, functionality: str, model_id: str) -> str:
    p = s3_prefix()
    return f"{p}/models/{disease_slug}/{functionality}/{model_id}.joblib"


def save_bytes(*, data: bytes, disease_slug: str, sha256: str, original_ext: str) -> str:
    """Persist raw bytes; returns storageKey (S3 key or relative path under local root)."""
    ext = original_ext if original_ext.startswith(".") else f".{original_ext}"
    kind = storage_kind()
    key = f"assets/{disease_slug}/{sha256}{ext}"

    if kind == "s3":
        bucket = s3_bucket()
        if not bucket:
            raise RuntimeError("DISEASE_ML_STORAGE=s3 requires DISEASE_ML_S3_BUCKET")
        import boto3

        full = build_object_key(disease_slug, sha256, ext)
        client = boto3.client("s3")
        client.upload_fileobj(io.BytesIO(data), bucket, full)
        return f"s3://{bucket}/{full}"

    root = storage_root()
    path = root / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key


def load_bytes(storage_key: str) -> bytes:
    if storage_key.startswith("s3://"):
        # s3://bucket/key
        rest = storage_key[5:]
        bucket, _, key = rest.partition("/")
        import boto3

        client = boto3.client("s3")
        buf = io.BytesIO()
        client.download_fileobj(bucket, key, buf)
        return buf.getvalue()

    path = storage_root() / storage_key
    if not path.is_file():
        raise FileNotFoundError(storage_key)
    return path.read_bytes()


def save_artifact_local_or_s3(*, data: bytes, disease_slug: str, functionality: str, model_id: str) -> str:
    kind = storage_kind()
    if kind == "s3":
        bucket = s3_bucket()
        if not bucket:
            raise RuntimeError("DISEASE_ML_STORAGE=s3 requires DISEASE_ML_S3_BUCKET")
        import boto3

        key = build_artifact_key(disease_slug, functionality, model_id)
        client = boto3.client("s3")
        client.upload_fileobj(io.BytesIO(data), bucket, key)
        return f"s3://{bucket}/{key}"

    rel = f"models/{disease_slug}/{functionality}/{model_id}.joblib"
    path = storage_root() / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return rel
