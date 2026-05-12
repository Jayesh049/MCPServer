"""
Wikipedia + TF-IDF/SVD RAG; persists to Prisma tables Question + CorpusEntry (RagChunk).
Response shape aligned with Node DynamicWebRagResult.
"""

from __future__ import annotations

import hashlib
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
import numpy as np
import psycopg
from psycopg.types.json import Json
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from agent.app.wiki_fetch import fetch_corpus_text, split_chunks


def question_slug_from_text(q: str) -> str:
    n = " ".join(q.strip().split()).lower()
    h = hashlib.sha256(n.encode("utf-8")).hexdigest()[:24]
    return f"q_{h}"


def top_k() -> int:
    return min(50, max(1, int(os.environ.get("RAG_TOP_K", "5"))))


def get_or_create_question(
    cur: psycopg.Cursor, slug: str, title: str, prompt_text: str, kind: str
) -> str:
    cur.execute('SELECT id FROM "Question" WHERE slug = %s', (slug,))
    row = cur.fetchone()
    if row:
        qid = row[0]
        cur.execute(
            'UPDATE "Question" SET title = %s, "promptText" = %s, kind = %s::"QuestionKind" WHERE id = %s',
            (title, prompt_text, kind, qid),
        )
        return str(qid)
    qid = str(uuid.uuid4())
    cur.execute(
        """
        INSERT INTO "Question" (id, slug, title, "promptText", kind, "createdAt")
        VALUES (%s, %s, %s, %s, %s::"QuestionKind", NOW())
        """,
        (qid, slug, title, prompt_text, kind),
    )
    return qid


def delete_chunks(cur: psycopg.Cursor, question_id: str) -> None:
    cur.execute('DELETE FROM "CorpusEntry" WHERE "questionId" = %s', (question_id,))


def count_chunks(cur: psycopg.Cursor, question_id: str) -> int:
    cur.execute(
        'SELECT COUNT(*)::int FROM "CorpusEntry" WHERE "questionId" = %s',
        (question_id,),
    )
    row = cur.fetchone()
    return int(row[0]) if row else 0


def load_chunks(cur: psycopg.Cursor, question_id: str) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT id, content, meta, embedding, "createdAt"
        FROM "CorpusEntry"
        WHERE "questionId" = %s
        ORDER BY "createdAt" ASC
        """,
        (question_id,),
    )
    rows = cur.fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "id": str(r[0]),
                "content": str(r[1]),
                "meta": r[2],
                "embedding": r[3],
                "createdAt": r[4],
            }
        )
    return out


def _dt_iso(v: Any) -> str:
    if isinstance(v, datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.isoformat()
    return datetime.now(timezone.utc).isoformat()


def _train_and_scores(
    chunk_texts: list[str], question: str
) -> tuple[np.ndarray, list[float]]:
    """Return (indices_sorted_desc, scores) length = min(top_k, n)."""
    k = top_k()
    if not chunk_texts:
        return np.array([], dtype=int), []
    if len(chunk_texts) == 1:
        return np.array([0]), [1.0]
    max_feat = min(400, max(32, len(chunk_texts) * 8))
    vec = TfidfVectorizer(max_features=max_feat, stop_words="english")
    x = vec.fit_transform(chunk_texts)
    qv = vec.transform([question])
    if x.shape[0] < 4 or x.shape[1] < 4:
        sims = cosine_similarity(qv, x).flatten()
        order = np.argsort(-sims)[:k]
        scores = [float(sims[i]) for i in order]
        return order, scores
    n_comp = min(32, x.shape[0] - 1, x.shape[1] - 1)
    n_comp = max(1, n_comp)
    svd = TruncatedSVD(n_components=n_comp, random_state=42)
    xd = svd.fit_transform(x)
    qv = svd.transform(vec.transform([question]))
    sims = cosine_similarity(qv, xd).flatten()
    order = np.argsort(-sims)[:k]
    scores = [float(sims[i]) for i in order]
    return order, scores


def run_web_rag(
    conn: psycopg.Connection,
    question: str,
    refresh: bool,
    *,
    use_slug: str | None = None,
) -> dict[str, Any]:
    qn = " ".join(question.strip().split())
    if len(qn) < 3:
        raise ValueError("Question must be at least 3 characters.")

    slug = (use_slug or question_slug_from_text(qn)).strip()
    title = (qn[:200] + ("…" if len(qn) > 200 else ""))[:300]
    kind = "BANK" if slug.startswith("qb_") else "DYNAMIC"

    with conn.transaction():
        with conn.cursor() as cur:
            qid = get_or_create_question(cur, slug, title, qn, kind)
            n_before = count_chunks(cur, qid)
            needs_index = refresh or n_before == 0
            refreshed = needs_index and n_before > 0

            if needs_index:
                delete_chunks(cur, qid)
                with httpx.Client(
                    headers={"User-Agent": os.environ.get("WIKI_USER_AGENT", "MCPServerRagAgent/1.0")}
                ) as http:
                    corpus, wiki_title, page_url = fetch_corpus_text(http, qn)
                    chunk_texts = split_chunks(corpus)
                    if not chunk_texts:
                        chunk_texts = [(corpus or qn)[:900]]

                if len(chunk_texts) == 1:
                    cid = str(uuid.uuid4())
                    meta: dict[str, Any] = {
                        "source": "wikipedia",
                        "wikipediaTitle": wiki_title,
                        "pageUrl": page_url,
                    }
                    cur.execute(
                        """
                        INSERT INTO "CorpusEntry" (id, "questionId", content, meta, embedding, "createdAt")
                        VALUES (%s, %s, %s, %s, NULL, NOW())
                        """,
                        (cid, qid, chunk_texts[0], Json(meta)),
                    )
                else:
                    vec = TfidfVectorizer(
                        max_features=min(400, max(32, len(chunk_texts) * 8)),
                        stop_words="english",
                    )
                    x = vec.fit_transform(chunk_texts)
                    n_comp = min(32, x.shape[0] - 1, x.shape[1] - 1)
                    n_comp = max(1, n_comp)
                    svd = TruncatedSVD(n_components=n_comp, random_state=42)
                    xd = svd.fit_transform(x)
                    for i, txt in enumerate(chunk_texts):
                        emb = xd[i].astype(float).tolist()
                        meta = {
                            "source": "wikipedia",
                            "wikipediaTitle": wiki_title,
                            "pageUrl": page_url,
                            "chunkIndex": i,
                            "provider": "sklearn-tfidf-svd",
                        }
                        cid = str(uuid.uuid4())
                        cur.execute(
                            """
                            INSERT INTO "CorpusEntry" (id, "questionId", content, meta, embedding, "createdAt")
                            VALUES (%s, %s, %s, %s, %s, NOW())
                            """,
                            (cid, qid, txt, Json(meta), Json(emb)),
                        )

            indexed = count_chunks(cur, qid)
            rows = load_chunks(cur, qid)
            texts = [r["content"] for r in rows]
            order, scores = _train_and_scores(texts, qn)

    refreshed_out = refreshed if needs_index else False

    top_matches: list[dict[str, Any]] = []
    for rank, idx in enumerate(order.tolist() if hasattr(order, "tolist") else list(order)):
        r = rows[int(idx)]
        top_matches.append(
            {
                "id": r["id"],
                "score": scores[rank] if rank < len(scores) else 0.0,
                "content": r["content"],
                "meta": r["meta"],
                "createdAt": _dt_iso(r["createdAt"]),
            }
        )

    answer_preview = "\n\n".join(
        f"({i + 1}) {m['content'][:600]}{'…' if len(m['content']) > 600 else ''}"
        for i, m in enumerate(top_matches)
    )

    return {
        "slug": slug,
        "question": qn,
        "embeddingProvider": "sklearn-tfidf-svd",
        "webSource": "wikipedia",
        "indexedChunks": indexed,
        "refreshed": refreshed_out,
        "topMatches": top_matches,
        "answerPreview": answer_preview,
    }


def run_bank_rag(conn: psycopg.Connection, bank_slug: str, refresh: bool) -> dict[str, Any]:
    slug = bank_slug.strip()
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            'SELECT slug, "promptText", kind FROM "Question" WHERE slug = %s',
            (slug,),
        )
        row = cur.fetchone()
    if not row or not str(row.get("promptText") or "").strip():
        raise ValueError(f"Unknown bank slug or empty prompt: {slug}")
    prompt = str(row["promptText"]).strip()
    return run_web_rag(conn, prompt, refresh, use_slug=slug)


def connect_dsn() -> str:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")
    return dsn


def handle_ask(question: str, refresh: bool) -> dict[str, Any]:
    with psycopg.connect(connect_dsn()) as conn:
        return run_web_rag(conn, question, refresh)


def handle_bank(slug: str, refresh: bool) -> dict[str, Any]:
    with psycopg.connect(connect_dsn()) as conn:
        return run_bank_rag(conn, slug, refresh)
