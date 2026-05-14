from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class TrainingAssetRow:
    id: str
    disease_slug: str
    functionality: str
    kind: str  # PDF | IMAGE
    mime_type: str
    sha256: str
    storage_key: str
    extracted_text: str | None
    training_label: int | None
    meta: dict[str, Any] | None


@dataclass
class FunctionalityConfigRow:
    id: str
    disease_slug: str
    functionality: str
    formula_key: str
    hyperparams: dict[str, Any] | None
    is_active: bool


@dataclass
class TrainedModelRow:
    id: str
    config_id: str
    version: int
    artifact_storage_key: str
    metrics: dict[str, Any] | None
    trained_at: datetime
    n_samples: int
