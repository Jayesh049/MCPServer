from __future__ import annotations

import importlib.util
import logging
from pathlib import Path

from flask import Flask

log = logging.getLogger(__name__)


def register_per_disease_blueprints(app: Flask) -> None:
    """
    Load ml/diseases/<slug>/controller.py modules and register `blueprint` if defined.
    Hyphenated folder names are not Python packages; each controller loads its sibling model.py.
    """
    diseases_root = Path(__file__).resolve().parents[2] / "diseases"
    if not diseases_root.is_dir():
        log.debug("No ml/diseases directory; skip per-disease blueprints.")
        return

    for child in sorted(diseases_root.iterdir()):
        if not child.is_dir() or child.name.startswith(("_", ".")):
            continue
        ctrl = child / "controller.py"
        if not ctrl.is_file():
            continue
        mod_name = f"disease_ctrl_{child.name.replace('-', '_')}"
        spec = importlib.util.spec_from_file_location(mod_name, ctrl)
        if not spec or not spec.loader:
            continue
        module = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(module)
        except Exception as e:
            log.warning("Skip disease controller %s: %s", child.name, e)
            continue
        bp = getattr(module, "blueprint", None)
        if bp is not None:
            app.register_blueprint(bp)
            log.info("Registered disease blueprint: %s", bp.name)
