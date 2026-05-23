#!/usr/bin/env python3
"""
Predict imaging disease from base64 image on stdin or argv file path.

Usage:
  python imaging_sklearn_predict.py --slug brain-tumor --base64 "<base64>"
  python imaging_sklearn_predict.py --slug brain-tumor --path image.jpg
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from pathlib import Path

import joblib

REPO = Path(__file__).resolve().parents[2]
DEFAULT_ART = REPO / "ml" / "artifacts" / "imaging"
META_ROOT = REPO / "src" / "diseases" / "models" / "imaging"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    parser.add_argument("--base64", default="")
    parser.add_argument("--path", default="")
    args = parser.parse_args()

    slug = args.slug
    art = Path(os.environ.get("IMAGING_SKLEARN_PIPELINE", str(DEFAULT_ART / slug / "pipeline.joblib")))
    if not art.exists():
        print(json.dumps({"ok": False, "error": f"model not found: {art}"}))
        sys.exit(2)

    raw_b64 = args.base64.strip()
    if not raw_b64 and args.path:
        raw_b64 = base64.b64encode(Path(args.path).read_bytes()).decode("ascii")
    if not raw_b64 and not sys.stdin.isatty():
        raw_b64 = sys.stdin.read().strip()
    # Windows argv limit: prefer stdin when --base64 omitted and pipe used
    if not raw_b64:
        print(json.dumps({"ok": False, "error": "no image data"}))
        sys.exit(1)

    if "," in raw_b64 and raw_b64.startswith("data:"):
        raw_b64 = raw_b64.split(",", 1)[1]

    try:
        img_bytes = base64.b64decode(raw_b64)
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"invalid base64: {e}"}))
        sys.exit(1)

    bundle = joblib.load(art)
    pipe = bundle["pipeline"]
    size = int(bundle.get("imageSize", 128))

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from imaging_common import features_from_bytes  # noqa: E402

    feat = features_from_bytes(img_bytes, size=size).reshape(1, -1)
    pred = int(pipe.predict(feat)[0])
    proba = pipe.predict_proba(feat)[0]
    p_pos = float(proba[1]) if len(proba) >= 2 else float(proba[0])

    out: dict = {
        "ok": True,
        "slug": slug,
        "predictedClass": pred,
        "positiveProbability": p_pos,
        "positiveLabel": bundle.get("positiveLabel", "positive"),
        "negativeLabel": bundle.get("negativeLabel", "negative"),
    }
    meta_path = META_ROOT / f"{slug}-meta.json"
    if meta_path.exists():
        out["meta"] = json.loads(meta_path.read_text(encoding="utf-8"))
    print(json.dumps(out))


if __name__ == "__main__":
    main()
