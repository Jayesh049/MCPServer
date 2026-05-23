#!/usr/bin/env python3
"""
Download public imaging datasets into data/imaging/<slug>/positive|negative/.

Uses huggingface_hub snapshot_download (works on Python 3.14; avoids datasets.load_dataset bug).
Fallback: synthetic bootstrap if download fails.

Usage:
  python ml/scripts/download_imaging_datasets.py
  python ml/scripts/download_imaging_datasets.py --slug brain-tumor --max-per-class 80
"""
from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import sys
import zipfile
from pathlib import Path

import requests
from imaging_common import IMAGE_EXTS, REPO, disease_dir, list_images, load_config
from PIL import Image

try:
    import pandas as pd
    from huggingface_hub import hf_hub_download, list_repo_files
    from tqdm import tqdm
except ImportError:
    print("Install deps: pip install -r ml/requirements-imaging.txt", file=sys.stderr)
    sys.exit(1)


def folder_matches(name: str, patterns: list[str]) -> bool:
    n = name.lower().replace(" ", "_").replace("-", "_")
    for p in patterns:
        p = p.lower().replace(" ", "_")
        if p in n or n in p or n.endswith(p) or n.startswith(p):
            return True
    return False


def classify_path(path: Path, pos_patterns: list[str], neg_patterns: list[str]) -> str | None:
    for part in path.parts:
        if folder_matches(part, pos_patterns):
            return "positive"
        if folder_matches(part, neg_patterns):
            return "negative"
    return None


def save_image_bytes(data: bytes, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
        img.save(dest, format="JPEG", quality=90)
        return True
    except Exception:
        try:
            dest.write_bytes(data)
            return dest.exists()
        except Exception:
            return False


def copy_image_file(src: Path, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return True
    try:
        if src.suffix.lower() in IMAGE_EXTS:
            shutil.copy2(src, dest)
            return True
    except Exception:
        pass
    return False


def download_hf_snapshot(
    slug: str,
    source: dict,
    max_per_class: int,
    counts: dict[str, int],
) -> int:
    """Download labeled images file-by-file (no full repo snapshot)."""
    dataset_id = source["dataset"]
    pos_pat = source.get("positiveFolderNames", ["positive"])
    neg_pat = source.get("negativeFolderNames", ["negative"])
    split_prefix = source.get("pathPrefix", "train/")

    print(f"  HF images {dataset_id}...")
    try:
        all_files = list_repo_files(dataset_id, repo_type="dataset")
    except Exception as e:
        print(f"    skip: {e}")
        return 0

    images = [
        f
        for f in all_files
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
        and (not split_prefix or f.replace("\\", "/").startswith(split_prefix))
    ]
    saved = 0
    for img_rel in tqdm(images, desc=f"    {slug}", leave=False):
        if counts["positive"] >= max_per_class and counts["negative"] >= max_per_class:
            break
        cls = classify_path(Path(img_rel.replace("\\", "/")), pos_pat, neg_pat)
        if cls is None:
            continue
        if counts[cls] >= max_per_class:
            continue
        dest = disease_dir(slug, cls) / f"hf_{Path(img_rel).name}"
        if dest.exists():
            counts[cls] += 1
            continue
        try:
            local = hf_hub_download(dataset_id, img_rel, repo_type="dataset")
            if copy_image_file(Path(local), dest):
                counts[cls] += 1
                saved += 1
        except Exception:
            continue
    print(f"    +{saved} from HF files")
    return saved


def pil_from_cell(cell: object) -> Image.Image | None:
    try:
        if isinstance(cell, Image.Image):
            return cell
        if isinstance(cell, dict) and "bytes" in cell:
            return Image.open(io.BytesIO(cell["bytes"]))
        if isinstance(cell, (bytes, bytearray)):
            return Image.open(io.BytesIO(cell))
        if isinstance(cell, (str, Path)) and Path(cell).exists():
            return Image.open(cell)
    except Exception:
        return None
    return None


def download_hf_zip(
    slug: str,
    source: dict,
    max_per_class: int,
    counts: dict[str, int],
) -> int:
    dataset_id = source["dataset"]
    zip_names = source.get("zipFiles", ["Training.zip"])
    pos_pat = source.get("positiveFolderNames", ["positive"])
    neg_pat = source.get("negativeFolderNames", ["negative"])
    saved = 0

    for zname in zip_names:
        print(f"  HF zip {dataset_id}/{zname}...")
        try:
            zip_path = hf_hub_download(dataset_id, zname, repo_type="dataset")
        except Exception as e:
            print(f"    skip: {e}")
            continue
        with zipfile.ZipFile(zip_path, "r") as zf:
            for info in tqdm(zf.infolist(), desc=f"    {slug}", leave=False):
                if counts["positive"] >= max_per_class and counts["negative"] >= max_per_class:
                    break
                if info.is_dir() or not info.filename.lower().endswith(
                    tuple(ext.lstrip(".") for ext in IMAGE_EXTS)
                ):
                    continue
                parts = Path(info.filename).parts
                cls = classify_path(Path(*parts), pos_pat, neg_pat)
                if cls is None:
                    continue
                if counts[cls] >= max_per_class:
                    continue
                dest = disease_dir(slug, cls) / f"hf_{Path(info.filename).name}"
                if dest.exists():
                    counts[cls] += 1
                    continue
                try:
                    data = zf.read(info)
                    if save_image_bytes(data, dest):
                        counts[cls] += 1
                        saved += 1
                except Exception:
                    continue
    print(f"    +{saved} from HF zip")
    return saved


def label_from_ekacare_row(row: object) -> str | None:
    """Parse ekacare OCT/ Fundus Opt_* dict columns for Glaucoma yes/no."""
    if not hasattr(row, "get"):
        return None
    for col in ("Opt_1", "Opt_2", "Opt_3", "Opt_4"):
        val = row.get(col)
        if isinstance(val, dict):
            g = str(val.get("Glaucoma", "")).lower()
            if g in ("yes", "suspect"):
                return "positive"
            if g == "no":
                return "negative"
    return None


def download_hf_parquet(
    slug: str,
    source: dict,
    max_per_class: int,
    counts: dict[str, int],
) -> int:
    dataset_id = source["dataset"]
    img_col = source.get("imageColumn", "image")
    lbl_col = source.get("labelColumn", "label")
    pos_vals = source.get("positiveValues", ["1", "positive"])
    neg_vals = source.get("negativeValues", ["0", "negative"])
    parquet_glob = source.get("parquetGlob", "data/train")

    print(f"  HF parquet {dataset_id}...")
    try:
        files = [
            f
            for f in list_repo_files(dataset_id, repo_type="dataset")
            if f.endswith(".parquet") and parquet_glob in f.replace("\\", "/")
        ]
    except Exception as e:
        print(f"    skip list: {e}")
        return 0
    if not files:
        files = [f for f in list_repo_files(dataset_id, repo_type="dataset") if f.endswith(".parquet")]

    max_files = int(source.get("maxParquetFiles", 3))
    saved = 0
    for pf in files[:max_files]:
        if counts["positive"] >= max_per_class and counts["negative"] >= max_per_class:
            break
        local: Path | None = None
        try:
            local = Path(hf_hub_download(dataset_id, pf, repo_type="dataset"))
            df = pd.read_parquet(local)
        except Exception as e:
            print(f"    skip {pf}: {e}")
            continue
        lbl_col_use = lbl_col
        if lbl_col != "ekacare_opt" and lbl_col_use not in df.columns:
            for alt in ("dx", "labels", "class", "target", "diagnosis", "Label", "label"):
                if alt in df.columns:
                    lbl_col_use = alt
                    break
            else:
                if local and local.exists():
                    local.unlink(missing_ok=True)
                continue

        for i, row in df.iterrows():
            if counts["positive"] >= max_per_class and counts["negative"] >= max_per_class:
                break
            if lbl_col == "ekacare_opt":
                cls = label_from_ekacare_row(row)
            else:
                cls = label_to_class(row[lbl_col_use], pos_vals, neg_vals)
            if cls is None:
                continue
            if counts[cls] >= max_per_class:
                continue
            pil = pil_from_cell(row.get(img_col))
            if pil is None:
                continue
            dest = disease_dir(slug, cls) / f"hf_{pf.replace('/', '_')}_{i}.jpg"
            if dest.exists():
                counts[cls] += 1
                continue
            if save_pil(pil, dest):
                counts[cls] += 1
                saved += 1
        if local and local.exists():
            try:
                local.unlink()
            except OSError:
                pass
    print(f"    +{saved} from parquet")
    return saved


def download_hf_yolo(
    slug: str,
    source: dict,
    max_per_class: int,
    counts: dict[str, int],
) -> int:
    """YOLO layout: images/*.jpg + labels/*.txt (non-empty label = positive)."""
    dataset_id = source["dataset"]
    splits = source.get("splits", ["train", "valid", "test"])
    saved = 0
    print(f"  HF YOLO {dataset_id}...")
    try:
        all_files = list_repo_files(dataset_id, repo_type="dataset")
    except Exception as e:
        print(f"    skip: {e}")
        return 0

    for split in splits:
        if counts["positive"] >= max_per_class and counts["negative"] >= max_per_class:
            break
        images = [f for f in all_files if f.startswith(f"{split}/images/") and f.lower().endswith((".jpg", ".jpeg", ".png"))]
        for img_rel in tqdm(images, desc=f"    {slug}-{split}", leave=False):
            if counts["positive"] >= max_per_class and counts["negative"] >= max_per_class:
                break
            stem = Path(img_rel).stem
            lbl_rel = f"{split}/labels/{stem}.txt"
            if lbl_rel not in all_files:
                continue
            try:
                lbl_path = hf_hub_download(dataset_id, lbl_rel, repo_type="dataset")
                label_text = Path(lbl_path).read_text(encoding="utf-8").strip()
            except Exception:
                continue
            cls = "positive" if label_text else "negative"
            if counts[cls] >= max_per_class:
                continue
            dest = disease_dir(slug, cls) / f"hf_{stem}.jpg"
            if dest.exists():
                counts[cls] += 1
                continue
            try:
                img_path = hf_hub_download(dataset_id, img_rel, repo_type="dataset")
                if copy_image_file(Path(img_path), dest):
                    counts[cls] += 1
                    saved += 1
            except Exception:
                continue
    print(f"    +{saved} from YOLO")
    return saved


def download_hf_labeled_csv(
    slug: str,
    source: dict,
    max_per_class: int,
    counts: dict[str, int],
) -> int:
    dataset_id = source["dataset"]
    csv_file = source.get("csvFile", "Labels.csv")
    img_dir = source.get("imageFolder", "Images")
    lbl_col = source.get("labelColumn", "label")
    img_col = source.get("imageFileColumn", "image")
    pos_vals = source.get("positiveValues", ["1", "glaucoma", "positive"])
    neg_vals = source.get("negativeValues", ["0", "normal", "negative"])
    print(f"  HF CSV {dataset_id}/{csv_file}...")
    try:
        csv_path = hf_hub_download(dataset_id, csv_file, repo_type="dataset")
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"    skip: {e}")
        return 0
    if lbl_col not in df.columns:
        for alt in ("glaucoma", "label", "Label", "class", "diagnosis"):
            if alt in df.columns:
                lbl_col = alt
                break
    if img_col not in df.columns:
        for alt in ("image", "Image", "filename", "file", "img"):
            if alt in df.columns:
                img_col = alt
                break
    saved = 0
    for i, row in df.iterrows():
        if counts["positive"] >= max_per_class and counts["negative"] >= max_per_class:
            break
        cls = label_to_class(row.get(lbl_col), pos_vals, neg_vals)
        if cls is None:
            continue
        if counts[cls] >= max_per_class:
            continue
        img_name = str(row.get(img_col, "")).strip()
        if not img_name:
            continue
        img_rel = f"{img_dir}/{img_name}" if img_dir else img_name
        dest = disease_dir(slug, cls) / f"hf_{Path(img_name).name}"
        if dest.exists():
            counts[cls] += 1
            continue
        try:
            local = hf_hub_download(dataset_id, img_rel, repo_type="dataset")
            if copy_image_file(Path(local), dest):
                counts[cls] += 1
                saved += 1
        except Exception:
            continue
    print(f"    +{saved} from CSV")
    return saved


def label_to_class(
    raw: object, positive_values: list[str], negative_values: list[str]
) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip().lower()
    pos = {str(v).strip().lower() for v in positive_values}
    neg = {str(v).strip().lower() for v in negative_values}
    if s in pos:
        return "positive"
    if s in neg:
        return "negative"
    try:
        n = float(s)
        if n >= 1:
            return "positive"
        if n == 0:
            return "negative"
    except ValueError:
        pass
    if any(p in s for p in pos if len(p) > 2):
        return "positive"
    if any(n in s for n in neg if len(n) > 2):
        return "negative"
    return None


def save_pil(img: Image.Image, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.save(dest, format="JPEG", quality=90)
        return True
    except Exception:
        return False


def download_url_zip(
    slug: str,
    source: dict,
    max_per_class: int,
    counts: dict[str, int],
) -> int:
    url = source["url"]
    pos_pat = source.get("positiveFolderNames", ["positive"])
    neg_pat = source.get("negativeFolderNames", ["negative"])
    pos_hints = source.get("zipPositivePathHints", pos_pat)
    neg_hints = source.get("zipNegativePathHints", neg_pat)

    print(f"  ZIP {url[:60]}...")
    tmp = REPO / "data" / "imaging" / "_zip_cache" / slug
    tmp.mkdir(parents=True, exist_ok=True)
    zip_path = tmp / "archive.zip"
    try:
        r = requests.get(url, timeout=120, stream=True)
        r.raise_for_status()
        with open(zip_path, "wb") as f:
            for chunk in r.iter_content(65536):
                f.write(chunk)
        extract_dir = tmp / "extracted"
        if extract_dir.exists():
            shutil.rmtree(extract_dir)
        extract_dir.mkdir(parents=True)
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_dir)
    except Exception as e:
        print(f"    skip zip: {e}")
        return 0

    saved = 0
    for img_path in extract_dir.rglob("*"):
        if not img_path.is_file() or img_path.suffix.lower() not in IMAGE_EXTS:
            continue
        rel = str(img_path.relative_to(extract_dir)).lower()
        cls = None
        if any(h.lower() in rel for h in pos_hints):
            cls = "positive"
        elif any(h.lower() in rel for h in neg_hints):
            cls = "negative"
        if cls is None:
            cls = classify_path(img_path.relative_to(extract_dir), pos_pat, neg_pat)
        if cls is None:
            continue
        if counts[cls] >= max_per_class:
            continue
        dest = disease_dir(slug, cls) / f"zip_{img_path.name}"
        if copy_image_file(img_path, dest):
            counts[cls] += 1
            saved += 1
    print(f"    +{saved} from zip")
    return saved


def bootstrap_synthetic(slug: str, max_per_class: int, counts: dict[str, int]) -> int:
    import numpy as np

    saved = 0
    for cls, y_seed in (("negative", 0), ("positive", 1)):
        need = max(0, max_per_class - counts[cls])
        for i in range(need):
            rng = np.random.default_rng(y_seed * 10000 + i + hash(slug) % 997)
            arr = rng.random((128, 128, 3), dtype=np.float32) * 0.35 + 0.25
            if cls == "positive":
                for dy in range(-18, 19):
                    for dx in range(-18, 19):
                        if dx * dx + dy * dy < 18 * 18:
                            yy, xx = 64 + dy, 64 + dx
                            if 0 <= yy < 128 and 0 <= xx < 128:
                                arr[yy, xx] += 0.45
            arr = np.clip(arr, 0, 1)
            img = Image.fromarray((arr * 255).astype(np.uint8))
            dest = disease_dir(slug, cls) / f"synthetic_{cls}_{i:04d}.jpg"
            dest.parent.mkdir(parents=True, exist_ok=True)
            img.save(dest, format="JPEG", quality=90)
            counts[cls] += 1
            saved += 1
    if saved:
        print(f"  WARNING: bootstrap synthetic +{saved} — replace with real images for clinical accuracy")
    return saved


def download_slug(slug: str, max_per_class: int) -> dict[str, int]:
    cfg = load_config()
    disease = next((d for d in cfg["diseases"] if d["slug"] == slug), None)
    if not disease:
        raise ValueError(f"Unknown slug: {slug}")

    counts = {
        "positive": len(list_images(disease_dir(slug, "positive"))),
        "negative": len(list_images(disease_dir(slug, "negative"))),
    }
    print(f"\n[{slug}] existing pos={counts['positive']} neg={counts['negative']}")

    for source in disease.get("sources", []):
        if counts["positive"] >= max_per_class and counts["negative"] >= max_per_class:
            break
        st = source.get("type", "hf_snapshot")
        if st == "hf_snapshot":
            download_hf_snapshot(slug, source, max_per_class, counts)
        elif st == "hf_zip":
            download_hf_zip(slug, source, max_per_class, counts)
        elif st == "hf_parquet":
            download_hf_parquet(slug, source, max_per_class, counts)
        elif st == "hf_yolo":
            download_hf_yolo(slug, source, max_per_class, counts)
        elif st == "hf_labeled_csv":
            download_hf_labeled_csv(slug, source, max_per_class, counts)
        elif st == "url_zip":
            download_url_zip(slug, source, max_per_class, counts)

    real_pos = len([p for p in list_images(disease_dir(slug, "positive")) if "synthetic" not in p.name])
    real_neg = len([p for p in list_images(disease_dir(slug, "negative")) if "synthetic" not in p.name])
    if not getattr(download_slug, "_no_bootstrap", False):
        if real_pos < 8 or real_neg < 8:
            bootstrap_synthetic(slug, max(8, max_per_class // 4), counts)

    counts["positive"] = len(list_images(disease_dir(slug, "positive")))
    counts["negative"] = len(list_images(disease_dir(slug, "negative")))
    counts["realPositive"] = real_pos
    counts["realNegative"] = real_neg
    print(f"  done pos={counts['positive']} neg={counts['negative']} (real: {real_pos}/{real_neg})")
    return counts


def main() -> None:
    hf_cache = REPO / "data" / "imaging" / ".hf_cache"
    hf_cache.mkdir(parents=True, exist_ok=True)
    os.environ["HF_HOME"] = str(hf_cache)
    os.environ["HUGGINGFACE_HUB_CACHE"] = str(hf_cache / "hub")

    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", default="all")
    parser.add_argument("--max-per-class", type=int, default=None)
    parser.add_argument("--skip", default="", help="Comma-separated slugs to skip (e.g. brain-tumor)")
    parser.add_argument(
        "--no-bootstrap",
        action="store_true",
        help="Do not create synthetic placeholder images if download is insufficient",
    )
    args = parser.parse_args()

    cfg = load_config()
    max_per = args.max_per_class or int(cfg.get("maxPerClass", 100))
    skip = {s.strip() for s in args.skip.split(",") if s.strip()}
    download_slug._no_bootstrap = args.no_bootstrap  # type: ignore[attr-defined]
    slugs = [d["slug"] for d in cfg["diseases"]] if args.slug == "all" else [args.slug]
    slugs = [s for s in slugs if s not in skip]

    summary: dict[str, dict] = {}
    for slug in slugs:
        try:
            summary[slug] = download_slug(slug, max_per)
        except Exception as e:
            print(f"  ERROR {slug}: {e}", file=sys.stderr)
            summary[slug] = {"error": str(e)}

    out = REPO / "data" / "imaging" / "download_summary.json"
    out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"\nSummary: {out}")


if __name__ == "__main__":
    main()
