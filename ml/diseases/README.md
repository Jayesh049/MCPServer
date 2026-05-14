# Per-disease corpus ML stubs (`model.py` + `controller.py`)

Each subfolder under **`ml/diseases/<slug>/`** matches a **`slug`** in [`../config/diseases.json`](../config/diseases.json) (aligned with `src/diseases/registry.ts`).

| File | Role |
|------|------|
| **`model.py`** | Constants for this disease: `SLUG`, `DISPLAY_NAME`, `DEFAULT_FUNCTIONALITY`, `DEFAULT_FORMULA_KEY`, and `spec_dict()` for JSON metadata. |
| **`controller.py`** | Registers a small Flask **`blueprint`** with `GET /v1/diseases/<slug>/corpus-spec` (per-disease “controller”). |
| **`__init__.py`** | Package marker. |

**Shared** ingest / train / predict / models remain in **`ml/flask_disease/`** (`POST /v1/diseases/<slug>/assets`, etc.) so you do not duplicate HTTP logic in every folder.

## Regenerate stubs

After editing `ml/config/diseases.json`:

```bash
python ml/scripts/scaffold_disease_mvc.py
```

## Optional JSON exports

The ETL can still export Wikipedia snapshots here as `{slug}.json` (see [export script](../scripts/export_diseases_to_json.py)); those files are gitignored except this README.
