"""
Fetch English Wikipedia summaries + section text for registry disease slugs,
compute heuristic criticality, insert into Postgres (Prisma tables).

Run from repo root: python ml/scripts/fetch_and_insert.py
Requires DATABASE_URL and applied migration 20260512120000_disease_web_knowledge.
"""

from __future__ import annotations

import html as html_mod
import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any

import httpx
import psycopg
from dotenv import load_dotenv
from psycopg.types.json import Json

REPO_ROOT = Path(__file__).resolve().parents[2]
ML_ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = ML_ROOT / "config"

SPECIALIST_SECTION_PAT = re.compile(
    r"(treatment|management|prognosis|medical.?therapy|signs.?and.?symptoms|therapy|prevention)",
    re.I,
)
YOGA_SECTION_PAT = re.compile(
    r"(yoga|pranayama|breathing|lifestyle|exercise|physical.?therapy|rehabilitation)",
    re.I,
)

HIGH_KW = [
    ("mortality", 14),
    ("death rate", 12),
    ("fatal", 14),
    ("life-threatening", 12),
    ("pandemic", 10),
    ("epidemic", 10),
    ("leading cause of death", 16),
]
MED_KW = [
    ("chronic", 6),
    ("disability", 7),
    ("severe", 6),
    ("hospital", 5),
    ("emergency", 5),
    ("chemotherapy", 6),
    ("metastasis", 8),
]


def find_dotenv() -> Path | None:
    for p in [REPO_ROOT, REPO_ROOT.parent]:
        cand = p / ".env"
        if cand.is_file():
            return cand
    return None


def load_config() -> tuple[list[dict[str, Any]], dict[str, str]]:
    diseases_path = CONFIG_DIR / "diseases.json"
    overrides_path = CONFIG_DIR / "disease_wikipedia_titles.json"
    data = json.loads(diseases_path.read_text(encoding="utf-8"))
    diseases = data["diseases"]
    overrides: dict[str, str] = {}
    if overrides_path.is_file():
        o = json.loads(overrides_path.read_text(encoding="utf-8"))
        overrides = o.get("overrides") or {}
    return diseases, overrides


def strip_html(raw: str) -> str:
    s = re.sub(r"<[^>]+>", " ", raw)
    s = html_mod.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def clean_wikitext(wt: str) -> str:
    s = re.sub(r"\{\{[^}]*\}\}", " ", wt)
    s = re.sub(r"\[\[([^|\]]*\|)?([^\]]+)\]\]", r"\2", s)
    s = re.sub(r"'''?", "", s)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def infer_specialist_label(text: str) -> str:
    t = text.lower()
    if "surg" in t:
        return "Surgical specialist"
    if "oncolog" in t:
        return "Oncology specialist"
    if "cardio" in t or "heart" in t:
        return "Cardiology specialist"
    if "neuro" in t:
        return "Neurology specialist"
    if "nephro" in t or "kidney" in t:
        return "Nephrology specialist"
    if "pulmon" in t or "lung" in t:
        return "Pulmonology specialist"
    if "ophthal" in t or "eye" in t:
        return "Ophthalmology specialist"
    if "dermat" in t or "skin" in t:
        return "Dermatology specialist"
    if "endocrin" in t or "diabet" in t:
        return "Endocrinology specialist"
    if "infect" in t or "antibiotic" in t:
        return "Infectious disease specialist"
    return "Clinical specialist"


def bullets_from_text(text: str, max_items: int = 12) -> list[str]:
    if not text:
        return []
    parts = re.split(r"(?:\n|^)\s*[*•#]+\s*", text)
    out: list[str] = []
    for p in parts:
        p = p.strip()
        if len(p) < 40:
            continue
        out.append(p[:1200])
        if len(out) >= max_items:
            break
    if not out and len(text) > 60:
        for sentence in re.split(r"(?<=[.!?])\s+", text):
            if len(sentence) > 50:
                out.append(sentence.strip()[:1200])
            if len(out) >= max_items:
                break
    return out


def compute_criticality(
    meta: dict[str, Any],
    summary: str,
    section_texts: dict[str, str],
) -> tuple[float, str]:
    reasons: list[str] = []
    score = 18.0
    blob = (summary + " " + " ".join(section_texts.values())).lower()

    for kw, pts in HIGH_KW:
        if kw in blob:
            score += pts
            reasons.append(f"keyword:{kw}")
    for kw, pts in MED_KW:
        if kw in blob:
            score += pts
            reasons.append(f"keyword:{kw}")

    if meta.get("category") == "clinical":
        score += 10
        reasons.append("registry:clinical")
    if meta.get("category") == "signal":
        score += 4
        reasons.append("registry:signal")
    if meta.get("modality") == "imaging":
        score += 5
        reasons.append("registry:imaging")

    epi = ""
    for k, v in section_texts.items():
        if "epidemiology" in k.lower():
            epi = v
            break
    if epi:
        score += min(14.0, len(epi) / 350.0)
        reasons.append("section:epidemiology")

    score = max(0.0, min(100.0, round(score, 1)))
    rationale = (
        "Heuristic demo score from Wikipedia text signals + registry modality/category "
        f"(not a clinical metric). Signals: {'; '.join(reasons) or 'baseline'}."
    )
    return score, rationale


class WikiClient:
    def __init__(self) -> None:
        ua = os.environ.get(
            "WIKI_USER_AGENT",
            "MCPServerDiseaseETL/1.0 (https://github.com/Jayesh049/MCPServer; educational ETL)",
        )
        self._client = httpx.Client(
            headers={"User-Agent": ua, "Accept": "application/json"},
            timeout=45.0,
            follow_redirects=True,
        )
        self._sleep = float(os.environ.get("ETL_SLEEP_SEC", "0.35"))

    def close(self) -> None:
        self._client.close()

    def _nap(self) -> None:
        time.sleep(self._sleep)

    def rest_summary(self, title: str) -> dict[str, Any]:
        path = "https://en.wikipedia.org/api/rest_v1/page/summary/" + quote_title_path(
            title.replace(" ", "_")
        )
        last_err: Exception | None = None
        for attempt in range(4):
            try:
                r = self._client.get(path)
                if r.status_code == 429:
                    time.sleep(2.0 * (attempt + 1))
                    continue
                r.raise_for_status()
                self._nap()
                return r.json()
            except Exception as e:
                last_err = e
                time.sleep(1.0 * (attempt + 1))
        raise RuntimeError(f"REST summary failed for {title}: {last_err}")

    def mediawiki_parse(self, params: dict[str, Any]) -> dict[str, Any]:
        base = "https://en.wikipedia.org/w/api.php"
        q = {"format": "json", "formatversion": "2", **params}
        last_err: Exception | None = None
        for attempt in range(4):
            try:
                r = self._client.get(base, params=q)
                if r.status_code == 429:
                    time.sleep(2.0 * (attempt + 1))
                    continue
                r.raise_for_status()
                data = r.json()
                self._nap()
                return data
            except Exception as e:
                last_err = e
                time.sleep(1.0 * (attempt + 1))
        raise RuntimeError(f"MediaWiki parse failed {params}: {last_err}")


def quote_title_path(title: str) -> str:
    from urllib.parse import quote

    return quote(title.replace(" ", "_"), safe="/()'%,-._~")


def fetch_sections(client: WikiClient, page_title: str) -> list[dict[str, Any]]:
    data = client.mediawiki_parse(
        {
            "action": "parse",
            "page": page_title,
            "prop": "sections",
            "redirects": "true",
        }
    )
    parse = data.get("parse") or {}
    return list(parse.get("sections") or [])


def fetch_section_wikitext(client: WikiClient, page_title: str, index: str) -> str:
    data = client.mediawiki_parse(
        {
            "action": "parse",
            "page": page_title,
            "prop": "wikitext",
            "section": index,
            "redirects": "true",
        }
    )
    parse = data.get("parse") or {}
    wt_obj = parse.get("wikitext")
    if isinstance(wt_obj, str):
        wt = wt_obj
    else:
        wt = (wt_obj or {}).get("*") or ""
    return clean_wikitext(wt)


def fetch_section_html_text(client: WikiClient, page_title: str, index: str) -> str:
    data = client.mediawiki_parse(
        {
            "action": "parse",
            "page": page_title,
            "prop": "text",
            "section": index,
            "redirects": "true",
        }
    )
    parse = data.get("parse") or {}
    html = (parse.get("text") or "") or ""
    return strip_html(html)


def pick_sections(
    sections: list[dict[str, Any]], pattern: re.Pattern[str]
) -> list[tuple[str, str, str]]:
    """Return list of (section_title, index, line)."""
    out: list[tuple[str, str, str]] = []
    for s in sections:
        line = s.get("line") or ""
        if pattern.search(line):
            out.append((line, str(s.get("index", "")), line))
    return out


def new_id() -> str:
    return str(uuid.uuid4())


def upsert_disease(
    conn: psycopg.Connection,
    meta: dict[str, Any],
    wiki_title: str,
    summary: str,
    source_url: str | None,
    sections_meta: list[dict[str, Any]],
    specialists: list[tuple[str, str, str, str | None, str | None, str | None]],
    yogas: list[tuple[str, str, str | None, str | None, str | None, str | None]],
    crit: tuple[float, str],
) -> None:
    slug = meta["slug"]
    sections_json = Json(sections_meta)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "DiseaseWebInfo" (
              "id","slug","displayName","wikipediaTitle","summary","sourceUrl","sectionsJson","fetchedAt","updatedAt"
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
            ON CONFLICT ("slug") DO UPDATE SET
              "displayName" = EXCLUDED."displayName",
              "wikipediaTitle" = EXCLUDED."wikipediaTitle",
              "summary" = EXCLUDED."summary",
              "sourceUrl" = EXCLUDED."sourceUrl",
              "sectionsJson" = EXCLUDED."sectionsJson",
              "fetchedAt" = EXCLUDED."fetchedAt",
              "updatedAt" = CURRENT_TIMESTAMP
            """,
            (
                new_id(),
                slug,
                meta["displayName"],
                wiki_title,
                summary,
                source_url,
                sections_json,
            ),
        )

        cur.execute('DELETE FROM "DiseaseSpecialistInfo" WHERE "diseaseSlug" = %s', (slug,))
        for row in specialists:
            stype, role, excerpt, whensee, sec, excerpt2 = (
                row[0],
                row[1],
                row[2],
                row[3],
                row[4],
                row[5],
            )
            cur.execute(
                """
                INSERT INTO "DiseaseSpecialistInfo" (
                  "id","diseaseSlug","specialistType","roleDescription","whenToSee","sourceExcerpt","sourceSection","createdAt"
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,CURRENT_TIMESTAMP)
                """,
                (new_id(), slug, stype, role, whensee, excerpt or excerpt2, sec),
            )

        cur.execute('DELETE FROM "DiseaseYogaPranayamInfo" WHERE "diseaseSlug" = %s', (slug,))
        for row in yogas:
            name, desc, caution, ex, sec, _ = (row + (None,) * 6)[:6]
            cur.execute(
                """
                INSERT INTO "DiseaseYogaPranayamInfo" (
                  "id","diseaseSlug","practiceName","description","cautionNote","sourceExcerpt","sourceSection","createdAt"
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,CURRENT_TIMESTAMP)
                """,
                (new_id(), slug, name, desc, caution, ex, sec),
            )

        pct, rationale = crit
        cur.execute(
            """
            INSERT INTO "DiseaseCriticalityProfile" (
              "id","diseaseSlug","criticalityPercent","rationale","method","createdAt","updatedAt"
            ) VALUES (%s,%s,%s,%s,%s,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
            ON CONFLICT ("diseaseSlug") DO UPDATE SET
              "criticalityPercent" = EXCLUDED."criticalityPercent",
              "rationale" = EXCLUDED."rationale",
              "method" = EXCLUDED."method",
              "updatedAt" = CURRENT_TIMESTAMP
            """,
            (
                new_id(),
                slug,
                float(pct),
                rationale,
                "heuristic_wikipedia_keywords_and_registry_modality",
            ),
        )


def build_rows_for_slug(
    client: WikiClient,
    meta: dict[str, Any],
    wiki_title: str,
) -> tuple[
    dict[str, Any],
    str,
    str,
    str | None,
    list[dict[str, Any]],
    list[tuple[str, str, str, str | None, str | None, str | None]],
    list[tuple[str, str, str | None, str | None, str | None, str | None]],
    tuple[float, str],
]:
    summary_json = client.rest_summary(wiki_title)
    titles = summary_json.get("titles") or {}
    resolved_title = (
        titles.get("canonical")
        or titles.get("normalized")
        or wiki_title.replace("_", " ")
    )
    extract = summary_json.get("extract") or ""
    if not extract.strip():
        extract = summary_json.get("description") or ""
    source_url = summary_json.get("content_urls", {}).get("desktop", {}).get("page")

    sections = fetch_sections(client, resolved_title)
    sections_meta: list[dict[str, Any]] = [
        {
            "line": s.get("line"),
            "index": s.get("index"),
            "anchor": s.get("anchor"),
            "level": s.get("level"),
        }
        for s in sections
    ]

    specialist_texts: dict[str, str] = {}
    for title, idx, line in pick_sections(sections, SPECIALIST_SECTION_PAT):
        try:
            txt = fetch_section_wikitext(client, resolved_title, idx)
            if len(txt) < 80:
                txt = fetch_section_html_text(client, resolved_title, idx)
        except Exception:
            txt = ""
        if txt:
            specialist_texts[line] = txt

    combined_specialist = "\n\n".join(specialist_texts.values())
    spec_bullets = bullets_from_text(combined_specialist)
    specialists: list[tuple[str, str, str, str | None, str | None, str | None]] = []
    for b in spec_bullets:
        specialists.append(
            (
                infer_specialist_label(b),
                b,
                b[:800],
                "When symptoms worsen or before changing treatment; see Wikipedia source for context.",
                next(iter(specialist_texts.keys()), "Wikipedia"),
                None,
            )
        )
    if not specialists:
        ex = extract[:900]
        specialists.append(
            (
                "Primary care / specialist referral",
                "Wikipedia summary did not yield structured management bullets; review summary and consult clinicians.",
                ex,
                "Persistent or worsening symptoms.",
                "summary_fallback",
                None,
            )
        )

    yoga_texts: dict[str, str] = {}
    for title, idx, line in pick_sections(sections, YOGA_SECTION_PAT):
        try:
            txt = fetch_section_wikitext(client, resolved_title, idx)
            if len(txt) < 80:
                txt = fetch_section_html_text(client, resolved_title, idx)
        except Exception:
            txt = ""
        if txt:
            yoga_texts[line] = txt

    yogas: list[tuple[str, str, str | None, str | None, str | None, str | None]] = []
    for sec_title, txt in yoga_texts.items():
        for chunk in bullets_from_text(txt, max_items=4) or [txt[:1500]]:
            yogas.append(
                (
                    sec_title[:120],
                    chunk,
                    "Discuss new exercise or breathwork with your clinician, especially if cardiopulmonary disease.",
                    chunk[:500],
                    sec_title,
                    None,
                )
            )
    if not yogas:
        yogas = [
            (
                "Gentle breath awareness",
                "Slow nasal breathing and paced exhale may support relaxation alongside usual care; evidence varies by condition.",
                "Not a substitute for medical treatment; stop if dizzy or chest pain.",
                extract[:400],
                "template",
                None,
            ),
            (
                "Graded walking / mobility",
                "Light-to-moderate activity as tolerated is commonly discussed in chronic disease self-management literature.",
                "Individualize with a clinician if deconditioned, frail, or post-acute illness.",
                extract[:400],
                "template",
                None,
            ),
        ]

    section_texts_lower: dict[str, str] = {}
    for s in sections:
        line = s.get("line") or ""
        idx = str(s.get("index", ""))
        if "epidemiology" in line.lower():
            try:
                section_texts_lower["epidemiology"] = fetch_section_wikitext(
                    client, resolved_title, idx
                )
            except Exception:
                section_texts_lower["epidemiology"] = ""

    crit = compute_criticality(meta, extract, {**specialist_texts, **section_texts_lower})

    return (
        meta,
        wiki_title,
        extract,
        source_url,
        sections_meta,
        specialists,
        yogas,
        crit,
    )


def main() -> None:
    env_path = find_dotenv()
    if env_path:
        load_dotenv(env_path)
    else:
        load_dotenv()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL is not set (add to .env at repo root).")

    diseases, overrides = load_config()
    client = WikiClient()
    failed = 0
    try:
        with psycopg.connect(dsn) as conn:
            conn.execute("SELECT 1")
            for meta in diseases:
                slug = meta["slug"]
                title = overrides.get(slug) or meta.get("wikipediaTitle")
                if not title:
                    title = "_".join(p.capitalize() for p in slug.split("-"))
                print(f"Fetching {slug} -> {title} ...", flush=True)
                try:
                    payload = build_rows_for_slug(client, meta, title)
                    upsert_disease(conn, *payload)
                    conn.commit()
                    print(f"  OK {slug}", flush=True)
                except Exception as e:
                    conn.rollback()
                    failed += 1
                    print(f"  FAIL {slug}: {e}", flush=True)
    finally:
        client.close()
    if failed:
        raise SystemExit(f"ETL finished with {failed} failure(s).")


if __name__ == "__main__":
    main()
