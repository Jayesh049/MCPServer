from __future__ import annotations

import io
from typing import Literal

from pypdf import PdfReader


def extract_pdf_text(data: bytes, max_pages: int = 40) -> str:
    reader = PdfReader(io.BytesIO(data))
    parts: list[str] = []
    for i, page in enumerate(reader.pages[:max_pages]):
        try:
            t = page.extract_text() or ""
        except Exception:
            t = ""
        if t.strip():
            parts.append(t)
    return "\n\n".join(parts).strip()


def placeholder_image_text() -> str:
    return ""
