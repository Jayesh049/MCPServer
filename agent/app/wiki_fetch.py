"""Fetch Wikipedia summary text for a free-form query (OpenSearch + REST summary)."""

from __future__ import annotations

import html as html_mod
import re
from typing import Any
from urllib.parse import quote

import httpx

UA = "MCPServerRagAgent/1.0 (https://github.com/Jayesh049/MCPServer; educational RAG)"


def _strip_html(raw: str) -> str:
    s = re.sub(r"<[^>]+>", " ", raw)
    s = html_mod.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def wiki_search_title(client: httpx.Client, query: str) -> str | None:
    q = query.strip()[:240]
    if len(q) < 3:
        return None
    r = client.get(
        "https://en.wikipedia.org/w/api.php",
        params={
            "action": "opensearch",
            "search": q,
            "limit": 1,
            "namespace": 0,
            "format": "json",
        },
        headers={"User-Agent": UA},
        timeout=30.0,
    )
    r.raise_for_status()
    data = r.json()
    if isinstance(data, list) and len(data) >= 2 and isinstance(data[1], list) and data[1]:
        return str(data[1][0])
    return None


def wiki_summary_extract(client: httpx.Client, title: str) -> tuple[str, str | None]:
    """Return (plain extract, desktop page URL)."""
    path = "https://en.wikipedia.org/api/rest_v1/page/summary/" + quote(
        title.replace(" ", "_"), safe="/()'%,-._~"
    )
    r = client.get(path, headers={"User-Agent": UA}, timeout=30.0)
    r.raise_for_status()
    data: dict[str, Any] = r.json()
    extract = str(data.get("extract") or data.get("description") or "")
    url = None
    urls = data.get("content_urls") or {}
    if isinstance(urls, dict):
        desk = urls.get("desktop") or {}
        if isinstance(desk, dict):
            url = desk.get("page")
    return extract.strip(), url


def fetch_corpus_text(client: httpx.Client, question: str) -> tuple[str, str | None, str | None]:
    """
    Returns (corpus_plaintext, wikipedia_title_used, source_url).
    """
    title = wiki_search_title(client, question)
    if not title:
        return question[:4000], None, None
    extract, url = wiki_summary_extract(client, title)
    if not extract:
        return question[:4000], title, url
    return extract[:12000], title, url


def split_chunks(text: str, max_chars: int = 900, max_chunks: int = 24) -> list[str]:
    parts = re.split(r"\n{2,}", text)
    out: list[str] = []
    buf = ""
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if len(buf) + len(p) + 2 <= max_chars:
            buf = f"{buf}\n\n{p}".strip() if buf else p
        else:
            if buf:
                out.append(buf)
                buf = p
            while len(p) > max_chars:
                out.append(p[:max_chars])
                p = p[max_chars:]
                if len(out) >= max_chunks:
                    return out
            buf = p
        if len(out) >= max_chunks:
            break
    if buf and len(out) < max_chunks:
        out.append(buf)
    if not out and text.strip():
        out.append(text.strip()[:max_chars])
    return out[:max_chunks]
