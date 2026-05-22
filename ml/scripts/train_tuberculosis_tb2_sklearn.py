#!/usr/bin/env python3
"""
Train real sklearn classifiers for tuberculosis TEXT detection from TB2.pdf (+ TB.pdf).

Methodology aligned with Rawat et al. (TB2.pdf):
  - Multiple representations → we use TF-IDF (1,2)-grams (text analogue to molecular fingerprints)
  - Classifiers: Logistic Regression + Random Forest (paper uses LR, RF, XGBoost, …)
  - Evaluation: stratified k-fold ROC-AUC (paper uses 10-fold CV + AUC)

Outputs:
  ml/artifacts/tuberculosis/tb2_sklearn_pipeline.joblib
  src/diseases/models/tb2-sklearn-meta.json
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from pypdf import PdfReader
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline

REPO = Path(__file__).resolve().parents[2]
ARTIFACT = REPO / "ml" / "artifacts" / "tuberculosis"
META_OUT = REPO / "src" / "diseases" / "models" / "tb2-sklearn-meta.json"
PIPE_OUT = ARTIFACT / "tb2_sklearn_pipeline.joblib"

# Non-TB clinical/educational negatives (synthetic + generic; no PHI)
NEGATIVE_SNIPPETS = [
    "Type 2 diabetes mellitus with HbA1c 8.2% and fasting glucose 165 mg/dL. Metformin titration discussed.",
    "Hypertension stage 2: systolic blood pressure 158 mmHg on repeat measurement. ACE inhibitor started.",
    "Acute coronary syndrome ruled out. Troponin negative. ECG shows normal sinus rhythm without ST elevation.",
    "Chronic kidney disease stage 3b with eGFR 38 and moderate proteinuria. Nephrology follow-up in 3 months.",
    "Non-alcoholic fatty liver disease with elevated ALT AST and hepatic steatosis on ultrasound.",
    "Community-acquired pneumonia with lobar consolidation on chest radiograph. Empiric antibiotics initiated.",
    "COVID-19 SARS-CoV-2 PCR positive. Ground glass opacities on CT chest. Isolation precautions.",
    "Melanoma skin lesion excision pathology pending. Dermatology wide local excision planned.",
    "Breast mammogram BIRADS 2 benign findings. Routine annual screening recommended.",
    "Bone fracture distal radius displaced. Orthopedic reduction and casting performed.",
    "Glaucoma suspect with elevated intraocular pressure. Visual field testing scheduled.",
    "Obstructive sleep apnea STOP-BANG score 6. Home sleep study recommended for CPAP trial.",
    "Heart failure with reduced ejection fraction 35%. Guideline directed medical therapy optimized.",
    "Ischemic stroke NIHSS 4. Thrombolysis contraindicated due to recent surgery.",
    "Alzheimer dementia mild cognitive impairment. Memory clinic referral for cognitive testing.",
    "Parkinson disease resting tremor and bradykinesia. Levodopa trial discussed with neurology.",
    "Diabetic retinopathy moderate NPDR without macular edema. Ophthalmology screening in 6 months.",
    "Lung cancer pulmonary nodule 9mm. CT surveillance versus PET scan discussion.",
    "Cardiac catheterization shows patent coronary arteries. Chest pain likely non-cardiac etiology.",
    "Appendicitis acute abdomen CT findings. General surgery consultation for appendectomy.",
    "Urinary tract infection E coli bacteriuria. Oral antibiotics for uncomplicated cystitis.",
    "Asthma exacerbation wheeze and bronchodilator response. Inhaled corticosteroid step-up.",
    "Rheumatoid arthritis positive RF and joint erosions. DMARD therapy initiated by rheumatology.",
    "Hepatitis C RNA undetectable after direct acting antiviral course. Sustained virologic response.",
    "Iron deficiency anemia hemoglobin 9.2. Oral iron supplementation and GI evaluation.",
]


def extract_pdf_text(path: Path) -> str:
    reader = PdfReader(str(path))
    parts: list[str] = []
    for page in reader.pages:
        t = page.extract_text() or ""
        if t.strip():
            parts.append(t)
    return "\n".join(parts)


def chunk_text(text: str, min_len: int = 180, max_len: int = 900) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    paras = [p.strip() for p in re.split(r"(?<=[.!?])\s+", text) if len(p.strip()) >= 40]
    chunks: list[str] = []
    buf = ""
    for p in paras:
        if len(buf) + len(p) < max_len:
            buf = (buf + " " + p).strip()
        else:
            if len(buf) >= min_len:
                chunks.append(buf)
            buf = p
    if len(buf) >= min_len:
        chunks.append(buf)
    # sliding windows for long single blocks
    if len(chunks) < 8 and len(text) > max_len:
        step = max_len // 2
        for i in range(0, len(text) - min_len, step):
            chunks.append(text[i : i + max_len].strip())
    return chunks


def build_dataset() -> tuple[list[str], list[int]]:
    texts: list[str] = []
    labels: list[int] = []

    for name in ("TB2.pdf", "TB.pdf"):
        p = REPO / name
        if not p.exists():
            print(f"warn: missing {p}", file=sys.stderr)
            continue
        raw = extract_pdf_text(p)
        for c in chunk_text(raw):
            texts.append(c)
            labels.append(1)

    for snip in NEGATIVE_SNIPPETS:
        texts.append(snip)
        labels.append(0)

    # Extra negatives from ml README if present
    readme = REPO / "ml" / "README.md"
    if readme.exists():
        raw = readme.read_text(encoding="utf-8", errors="ignore")
        for c in chunk_text(raw)[:12]:
            texts.append(c)
            labels.append(0)

    return texts, labels


def eval_pipeline(pipe: Pipeline, X: list[str], y: np.ndarray) -> dict:
    n_splits = min(10, max(3, min(np.bincount(y)) * 2))
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    try:
        proba = cross_val_predict(pipe, X, y, cv=cv, method="predict_proba")[:, 1]
        auc = float(roc_auc_score(y, proba))
    except Exception as e:
        auc = 0.0
        proba = None
        err = str(e)
    else:
        err = None

    pipe.fit(X, y)
    pred = pipe.predict(X)
    return {
        "cvFolds": n_splits,
        "cvAuc": auc,
        "cvAucError": err,
        "trainAccuracy": float(accuracy_score(y, pred)),
        "trainF1": float(f1_score(y, pred, zero_division=0)),
        "nSamples": len(X),
        "nPositive": int(y.sum()),
        "nNegative": int(len(y) - y.sum()),
    }


def main() -> None:
    X, y_list = build_dataset()
    y = np.array(y_list, dtype=int)
    if len(X) < 10 or y.sum() < 3 or (len(y) - y.sum()) < 3:
        print("error: insufficient training samples", file=sys.stderr)
        sys.exit(1)

    candidates: list[tuple[str, Pipeline]] = [
        (
            "tfidf_logistic_regression",
            Pipeline(
                [
                    (
                        "vec",
                        TfidfVectorizer(
                            max_features=8000,
                            ngram_range=(1, 2),
                            min_df=1,
                            stop_words="english",
                            sublinear_tf=True,
                        ),
                    ),
                    (
                        "clf",
                        LogisticRegression(
                            max_iter=3000,
                            class_weight="balanced",
                            random_state=42,
                        ),
                    ),
                ]
            ),
        ),
        (
            "tfidf_random_forest",
            Pipeline(
                [
                    (
                        "vec",
                        TfidfVectorizer(
                            max_features=6000,
                            ngram_range=(1, 2),
                            min_df=1,
                            stop_words="english",
                            sublinear_tf=True,
                        ),
                    ),
                    (
                        "clf",
                        RandomForestClassifier(
                            n_estimators=200,
                            max_depth=24,
                            class_weight="balanced",
                            random_state=42,
                            n_jobs=-1,
                        ),
                    ),
                ]
            ),
        ),
    ]

    best_name = ""
    best_pipe: Pipeline | None = None
    best_metrics: dict = {}

    for name, pipe in candidates:
        m = eval_pipeline(pipe, X, y)
        m["formulaKey"] = name
        print(json.dumps({"candidate": name, **m}), file=sys.stderr)
        auc = m.get("cvAuc") or 0
        if best_pipe is None or auc >= (best_metrics.get("cvAuc") or 0):
            best_name = name
            best_pipe = pipe
            best_metrics = m

    assert best_pipe is not None
    ARTIFACT.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_pipe, PIPE_OUT)

    meta = {
        "diseaseSlug": "tuberculosis",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "sourcePdfs": ["TB2.pdf", "TB.pdf"],
        "sourceCitation": (
            "Rawat A et al. Development of machine learning models to identify potentially active "
            "compounds against tuberculosis. Sci Rep / Springer Open Access 2024; "
            "plus Memon 2025 TB management review (TB.pdf)."
        ),
        "methodology": {
            "positiveClass": "TB-related text chunks from TB2.pdf + TB.pdf",
            "negativeClass": "Non-TB clinical snippets + ml/README excerpts",
            "features": "TF-IDF (1,2)-grams, max_features 6k–8k",
            "classifiersEvaluated": ["tfidf_logistic_regression", "tfidf_random_forest"],
            "selectedClassifier": best_name,
            "evaluationMetric": "Stratified k-fold ROC-AUC (TB2 paper uses 10-fold CV + AUC)",
        },
        "metrics": best_metrics,
        "artifactPath": str(PIPE_OUT.relative_to(REPO)).replace("\\", "/"),
        "disclaimer": "Educational text classifier — not for clinical diagnosis.",
    }
    META_OUT.parent.mkdir(parents=True, exist_ok=True)
    META_OUT.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(json.dumps({"ok": True, "meta": meta}, indent=2))


if __name__ == "__main__":
    main()
