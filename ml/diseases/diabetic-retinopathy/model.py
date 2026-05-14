"""
Disease corpus ML metadata for `diabetic-retinopathy`.
Training/ingest use the shared Flask app (`ml/flask_disease/`); rows live in Postgres.
"""

SLUG = "diabetic-retinopathy"
DISPLAY_NAME = "Diabetic retinopathy (retina image)"
CATEGORY = "imaging"
MODALITY = "imaging"

# Default sklearn pipeline key for `DiseaseFunctionalityConfig.formulaKey` (override in DB).
DEFAULT_FORMULA_KEY = "tfidf_lr"
# Default RAG/corpus functionality bucket for this disease.
DEFAULT_FUNCTIONALITY = "educational_triage_text"


def spec_dict() -> dict:
    return {
        "slug": SLUG,
        "displayName": DISPLAY_NAME,
        "category": CATEGORY,
        "modality": MODALITY,
        "defaultFunctionality": DEFAULT_FUNCTIONALITY,
        "defaultFormulaKey": DEFAULT_FORMULA_KEY,
        "sharedEndpoints": {
            "ingest": f"POST /v1/diseases/{SLUG}/assets",
            "train": f"POST /v1/diseases/{SLUG}/train",
            "models": f"GET /v1/diseases/{SLUG}/models",
            "predict": f"POST /v1/diseases/{SLUG}/predict",
        },
    }
