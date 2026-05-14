from __future__ import annotations

from typing import Any

from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import HashingVectorizer, TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC


def _merge(default: dict[str, Any], hyper: dict[str, Any] | None) -> dict[str, Any]:
    out = dict(default)
    if hyper:
        out.update(hyper)
    return out


def build_pipeline(formula_key: str, hyperparams: dict[str, Any] | None) -> Pipeline:
    """Map formulaKey (DB-driven) to a sklearn Pipeline."""
    h = hyperparams or {}

    if formula_key == "tfidf_lr":
        d = {"max_features": 4000, "ngram_range": (1, 2), "min_df": 1}
        m = _merge(d, h.get("vectorizer"))
        vec = TfidfVectorizer(**m)
        lr_d = {"max_iter": 2000, "random_state": 42}
        lr = LogisticRegression(**_merge(lr_d, h.get("classifier")))
        return Pipeline([("vec", vec), ("clf", lr)])

    if formula_key == "tfidf_svd_lr":
        tfidf_d = {"max_features": 8000, "ngram_range": (1, 2), "min_df": 1}
        vec = TfidfVectorizer(**_merge(tfidf_d, h.get("vectorizer")))
        svd_d = {"n_components": 128, "random_state": 42}
        svd = TruncatedSVD(**_merge(svd_d, h.get("svd")))
        lr_d = {"max_iter": 2000, "random_state": 42}
        lr = LogisticRegression(**_merge(lr_d, h.get("classifier")))
        return Pipeline([("vec", vec), ("svd", svd), ("clf", lr)])

    if formula_key == "hashing_svc":
        hv_d = {"n_features": 1 << 16, "alternate_sign": False}
        vec = HashingVectorizer(**_merge(hv_d, h.get("vectorizer")))
        svc_d = {"dual": False, "max_iter": 5000, "random_state": 42}
        clf = LinearSVC(**_merge(svc_d, h.get("classifier")))
        return Pipeline([("vec", vec), ("clf", clf)])

    raise ValueError(f"Unknown formulaKey: {formula_key}")
