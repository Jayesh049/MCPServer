# Exported disease JSON (optional)

**Primary storage:** Postgres tables from the ETL — `DiseaseWebInfo`, `DiseaseSpecialistInfo`, `DiseaseYogaPranayamInfo`, `DiseaseCriticalityProfile` (see root `prisma/schema.prisma`).

This folder holds **optional JSON snapshots** produced for local use, reports, or version control (ignored by git except this file).

Generate files:

```bash
python ml/scripts/export_diseases_to_json.py
```

Outputs one `{slug}.json` per disease plus `index.json` listing slugs.
