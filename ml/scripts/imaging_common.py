"""Shared imaging feature extraction (Pillow + numpy only — no scikit-image)."""
from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
CONFIG_PATH = Path(__file__).resolve().parent / "imaging_disease_config.json"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}


def load_config() -> dict[str, Any]:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def disease_dir(slug: str, label: str, data_root: Path | None = None) -> Path:
    cfg = load_config()
    root = data_root or (REPO / cfg.get("dataRoot", "data/imaging"))
    return root / slug / label


def list_images(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    out: list[Path] = []
    for p in sorted(folder.rglob("*")):
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS:
            out.append(p)
    return out


def load_rgb_array(source: str | Path | bytes, size: int = 128) -> np.ndarray:
    if isinstance(source, bytes):
        img = Image.open(io.BytesIO(source)).convert("RGB")
    else:
        img = Image.open(source).convert("RGB")
    img = img.resize((size, size), Image.Resampling.BILINEAR)
    return np.asarray(img, dtype=np.float32) / 255.0


def _simple_grad_features(gray: np.ndarray) -> np.ndarray:
    """Gradient magnitude stats (HOG-like, lightweight)."""
    gx = np.zeros_like(gray)
    gy = np.zeros_like(gray)
    gx[:, 1:-1] = gray[:, 2:] - gray[:, :-2]
    gy[1:-1, :] = gray[2:, :] - gray[:-2, :]
    mag = np.sqrt(gx * gx + gy * gy)
    ang = np.arctan2(gy, gx)
    # 8 orientation bins over 4x4 grid
    h, w = gray.shape
    cell = 32
    feats: list[float] = []
    for cy in range(0, h, cell):
        for cx in range(0, w, cell):
            patch_m = mag[cy : cy + cell, cx : cx + cell]
            patch_a = ang[cy : cy + cell, cx : cx + cell]
            for b in range(8):
                lo, hi = -np.pi + b * (2 * np.pi / 8), -np.pi + (b + 1) * (2 * np.pi / 8)
                mask = (patch_a >= lo) & (patch_a < hi)
                feats.append(float(patch_m[mask].sum()))
    return np.array(feats, dtype=np.float32)


def extract_features(arr: np.ndarray) -> np.ndarray:
    gray = arr.mean(axis=2)
    hist_r, _ = np.histogram(arr[:, :, 0], bins=16, range=(0, 1), density=True)
    hist_g, _ = np.histogram(arr[:, :, 1], bins=16, range=(0, 1), density=True)
    hist_b, _ = np.histogram(arr[:, :, 2], bins=16, range=(0, 1), density=True)
    grad = _simple_grad_features(gray)
    # Downsampled pixels (8x8) for texture
    small = np.array(Image.fromarray((gray * 255).astype(np.uint8)).resize((8, 8))).flatten() / 255.0
    stats = np.array(
        [
            float(arr.mean()),
            float(arr.std()),
            float(gray.mean()),
            float(gray.std()),
            float(np.percentile(gray, 10)),
            float(np.percentile(gray, 90)),
        ],
        dtype=np.float32,
    )
    return np.concatenate([hist_r, hist_g, hist_b, grad, small, stats]).astype(np.float32)


def features_from_path(path: Path, size: int = 128) -> np.ndarray:
    return extract_features(load_rgb_array(path, size=size))


def features_from_bytes(data: bytes, size: int = 128) -> np.ndarray:
    return extract_features(load_rgb_array(data, size=size))


def build_matrix(
    slug: str, data_root: Path | None = None, size: int = 128
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    rows: list[np.ndarray] = []
    labels: list[int] = []
    paths: list[str] = []

    for label_name, y_val in (("negative", 0), ("positive", 1)):
        folder = disease_dir(slug, label_name, data_root)
        for p in list_images(folder):
            try:
                rows.append(features_from_path(p, size=size))
                labels.append(y_val)
                paths.append(str(p))
            except Exception:
                continue

    if not rows:
        return np.empty((0, 0)), np.array([]), []

    return np.vstack(rows), np.array(labels, dtype=np.int32), paths
