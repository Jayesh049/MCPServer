# Disease Wikipedia ETL + criticality demo model

Educational pipeline: fetches English Wikipedia summaries and selected sections for each disease **`slug`** in [`config/diseases.json`](config/diseases.json) (aligned with [`../src/diseases/registry.ts`](../src/diseases/registry.ts)), inserts into Postgres tables defined in [`../prisma/schema.prisma`](../prisma/schema.prisma), then optionally trains a small sklearn regressor on the stored text + metadata.

**Not for clinical decisions.** Content is from Wikipedia and heuristics; verify with qualified professionals.

## Prerequisites

- Python **3.11–3.13** recommended on **Windows** for `scikit-learn` wheels. Python **3.14** is OK for the **ETL** stack (`psycopg[binary]` needs **≥3.2.10** for wheels — see `requirements-etl.txt`).
- `DATABASE_URL` pointing at Postgres (same as Prisma), e.g. in repo-root `.env`
- Applied migration: `npm run db:migrate:deploy` (includes `20260512120000_disease_web_knowledge`)

## Wikimedia policy

Set a descriptive **User-Agent** (default in scripts includes project name). See [Wikimedia User-Agent policy](https://meta.wikimedia.org/wiki/User-Agent_policy). Scripts sleep ~350ms between requests to reduce load.

## Install

```bash
cd ml
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux/macOS
```

**ETL only** (no `scikit-learn` — avoids Windows compile errors):

```bash
pip install -r requirements-etl.txt
```

**Full stack** (ETL + training; needs compatible wheels for your Python):

```bash
pip install -r requirements.txt
```

If `scikit-learn` still tries to compile, stay on **`requirements-etl.txt`** for `fetch_and_insert.py`, and run training on Linux/CI or after installing [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the C++ workload.

## Where the disease data lives

1. **Database (source of truth)** — After `fetch_and_insert.py`, rows are in Postgres:
   - `DiseaseWebInfo` (one row per `slug`: Wikipedia summary + metadata)
   - `DiseaseSpecialistInfo`, `DiseaseYogaPranayamInfo` (many rows per `slug`)
   - `DiseaseCriticalityProfile` (one row per `slug`)

2. **Optional files on disk** — Folder [`diseases/`](diseases/) can hold JSON exports (not committed by default). Generate with:

```bash
python ml/scripts/export_diseases_to_json.py
```

This writes `ml/diseases/{slug}.json` for every slug in `config/diseases.json` plus `ml/diseases/index.json`.

## Run ETL (fetch + insert)

From repo root (so `.env` resolves):

```bash
python ml/scripts/fetch_and_insert.py
```

Optional env:

- `WIKI_USER_AGENT` — override HTTP User-Agent string
- `ETL_SLEEP_SEC` — default `0.35` between Wikipedia calls

## Train demo criticality regressor

Requires ETL run first:

```bash
python ml/scripts/train_criticality.py
```

Writes `ml/artifacts/criticality_model.joblib` and `ml/artifacts/metrics.json` (ignored by git).

## Tables

| Prisma model | Purpose |
|--------------|---------|
| `DiseaseWebInfo` | One row per slug: summary + Wikipedia title + optional `sectionsJson` |
| `DiseaseSpecialistInfo` | Care-pathway bullets from Treatment/Management-style sections |
| `DiseaseYogaPranayamInfo` | Lifestyle/yoga/pranayama snippets or conservative templates |
| `DiseaseCriticalityProfile` | Single heuristic score 0–100 per slug + rationale |
