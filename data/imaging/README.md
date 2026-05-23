# Imaging training data (10 diseases)

## Quick start

```powershell
npm run train:imaging:setup
npm run train:imaging:download
npm run train:imaging
npm run dev
```

Upload an image on `/diseases/<slug>` — the app uses `ml/artifacts/imaging/<slug>/pipeline.joblib`.

## Folder layout

```
data/imaging/<slug>/positive/*.jpg   # disease / finding present
data/imaging/<slug>/negative/*.jpg   # normal / absent
```

| Slug | Modality |
|------|----------|
| brain-tumor | MRI |
| covid-19 | Chest X-ray |
| skin-cancer | Skin photo |
| diabetic-retinopathy | Fundus |
| glaucoma | Fundus |
| cataract | Eye |
| breast-cancer | Mammogram |
| lung-cancer | CT / X-ray |
| bone-fracture | X-ray |
| alzheimers | Brain MRI |

## Download sources

Configured in `ml/scripts/imaging_disease_config.json`:

- **hf_snapshot** — Hugging Face dataset files (e.g. `alfa-bravo/Brain-Tumor-Mri-Dataset`)
- **url_zip** — optional ZIP URLs
- **bootstrap** — synthetic placeholders only if download fails (not for clinical use)

## Accuracy expectations

- **Real public images** (100+ per class): CV AUC often 0.75–0.95 depending on disease and image quality.
- **Synthetic bootstrap only**: models fit the synthetic pattern (demo); replace with real images before trusting results.
- **Clinical use**: not validated — educational / decision-support only.

## Manual data

Copy de-identified images into `positive/` or `negative/`, then:

```powershell
npm run train:imaging -- --slug brain-tumor
```

## Python env

- Recommended: Python 3.11 or 3.12 (3.14 works with `huggingface_hub` snapshot; avoid `datasets.load_dataset` on 3.14).
- Env: `IMAGING_ML_PYTHON=python` in `.env` if needed.
