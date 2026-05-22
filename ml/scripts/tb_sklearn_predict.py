#!/usr/bin/env python3
"""CLI: predict TB probability for one text blob. Usage: python tb_sklearn_predict.py "text..." """
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import joblib

REPO = Path(__file__).resolve().parents[2]
DEFAULT_PIPE = REPO / "ml" / "artifacts" / "tuberculosis" / "tb2_sklearn_pipeline.joblib"
META = REPO / "src" / "diseases" / "models" / "tb2-sklearn-meta.json"


def main() -> None:
    text = " ".join(sys.argv[1:]).strip() if len(sys.argv) > 1 else sys.stdin.read().strip()
    if not text:
        print(json.dumps({"ok": False, "error": "empty text"}))
        sys.exit(1)

    pipe_path = Path(os.environ.get("TB_SKLEARN_PIPELINE", str(DEFAULT_PIPE)))
    if not pipe_path.exists():
        print(json.dumps({"ok": False, "error": f"model not found: {pipe_path}"}))
        sys.exit(2)

    pipe = joblib.load(pipe_path)
    pred = int(pipe.predict([text])[0])
    out: dict = {"ok": True, "predictedClass": pred, "tbProbability": None}
    if hasattr(pipe, "predict_proba"):
        proba = pipe.predict_proba([text])[0]
        # class 1 = TB
        if len(proba) >= 2:
            out["tbProbability"] = float(proba[1])
        else:
            out["tbProbability"] = float(proba[0])
    else:
        out["tbProbability"] = 1.0 if pred == 1 else 0.0

    if META.exists():
        out["meta"] = json.loads(META.read_text(encoding="utf-8"))
    print(json.dumps(out))


if __name__ == "__main__":
    main()
