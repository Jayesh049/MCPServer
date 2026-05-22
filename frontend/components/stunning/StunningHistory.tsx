"use client";

import { useEffect, useState } from "react";

type AnswerRow = {
  id: string;
  source: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

function extractQa(row: AnswerRow): { question: string; answer: string } {
  const p = row.payload ?? {};
  const question =
    (typeof p.question === "string" && p.question) ||
    (typeof p.message === "string" && p.message) ||
    (typeof p.slug === "string" && p.slug) ||
    "—";
  const answer =
    (typeof p.patientText === "string" && p.patientText) ||
    (typeof p.answerPreview === "string" && p.answerPreview) ||
    (typeof p.geminiAnswer === "string" && p.geminiAnswer) ||
    (typeof p.answer === "string" && p.answer) ||
    "";
  return { question, answer };
}

export function StunningHistory() {
  const [items, setItems] = useState<AnswerRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void fetch("/api/answers?limit=20")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: { answers?: AnswerRow[] }) => {
        setItems(d.answers ?? []);
        setError(false);
      })
      .catch(() => {
        setItems([]);
        setError(true);
      });
  }, []);

  return (
    <>
      <div className="sec-h">
        <div>
          <div className="sec-title">Answer History</div>
          <div className="sec-sub">Past Q&A sessions persisted in Postgres</div>
        </div>
        <span className="src-pill">🗄 Postgres · /api/answers</span>
      </div>

      {items === null ? (
        <div style={{ color: "var(--txt3)", fontSize: 12 }}>
          <span className="spin" /> Loading from database…
        </div>
      ) : error ? (
        <div style={{ color: "var(--txt3)", fontSize: 12, padding: "16px 0" }}>
          Backend not running — history unavailable.
        </div>
      ) : items.length === 0 ? (
        <div style={{ color: "var(--txt3)", fontSize: 12, padding: "16px 0" }}>
          No history yet — ask a question in Patient Chat.
        </div>
      ) : (
        items.map((a) => {
          const { question, answer } = extractQa(a);
          return (
            <div key={a.id} className="hi-item">
              <div className="hi-q">{question}</div>
              <div className="hi-a">{answer.slice(0, 200)}{answer.length > 200 ? "…" : ""}</div>
              <div className="hi-m">
                <span className="src-pill">{a.source || "rag"}</span>
                <span className="src-pill gold">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
