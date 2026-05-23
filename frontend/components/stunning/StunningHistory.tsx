"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearAllAnswerHistory,
  deleteAnswerHistoryItem,
  extractQaFromRow,
  fetchAnswerHistory,
  type AnswerHistoryRow
} from "../../lib/answer-history";

export function StunningHistory() {
  const [items, setItems] = useState<AnswerHistoryRow[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await fetchAnswerHistory(25);
      setItems(rows);
      setError(false);
    } catch {
      setItems([]);
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDeleteOne(id: string) {
    if (busyId || clearing) return;
    if (!window.confirm("Delete this Q&A from your history?")) return;
    setBusyId(id);
    try {
      await deleteAnswerHistoryItem(id);
      setItems((prev) => (prev ?? []).filter((a) => a.id !== id));
    } catch {
      window.alert("Could not delete this entry. Is the backend running?");
    } finally {
      setBusyId(null);
    }
  }

  async function onClearAll() {
    if (busyId || clearing || !items?.length) return;
    if (
      !window.confirm(
        "Delete all saved Q&A history? This cannot be undone."
      )
    ) {
      return;
    }
    setClearing(true);
    try {
      await clearAllAnswerHistory();
      setItems([]);
    } catch {
      window.alert("Could not clear history. Is the backend running?");
    } finally {
      setClearing(false);
    }
  }

  return (
    <>
      <div className="sec-h">
        <div>
          <div className="sec-title">Answer History</div>
          <div className="sec-sub">
            Past Q&A from Patient Chat — you can delete individual entries or clear all.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {items && items.length > 0 ? (
            <button
              type="button"
              className="btn btn-g hi-clear-btn"
              disabled={clearing || !!busyId}
              onClick={() => void onClearAll()}
            >
              {clearing ? "Clearing…" : "Clear all history"}
            </button>
          ) : null}
          <span className="src-pill">🗄 Postgres · /api/answers</span>
        </div>
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
          const { question, answer } = extractQaFromRow(a);
          const deleting = busyId === a.id;
          return (
            <div key={a.id} className="hi-item">
              <div className="hi-item-top">
                <div className="hi-q">{question}</div>
                <button
                  type="button"
                  className="hi-del-btn"
                  title="Delete this entry"
                  disabled={deleting || clearing}
                  onClick={() => void onDeleteOne(a.id)}
                  aria-label="Delete history entry"
                >
                  {deleting ? <span className="spin" /> : "Delete"}
                </button>
              </div>
              <div className="hi-a">
                {answer.slice(0, 200)}
                {answer.length > 200 ? "…" : ""}
              </div>
              <div className="hi-m">
                <span className="src-pill">{a.source || "rag"}</span>
                <span className="src-pill gold">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
