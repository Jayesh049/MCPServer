"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clearHistory, loadHistory, type HistoryItem } from "../../lib/history";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setItems(loadHistory());
  }, []);

  return (
    <div>
      <div className="hero">
        <div className="hero-eyebrow">Session Data</div>
        <h1>
          Detection <em>History</em>
        </h1>
        <p className="hero-sub">
          Stored locally in your browser. Cleared with one click; nothing is sent to a server.
        </p>
      </div>

      <div style={{ padding: "0 48px 24px", display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            clearHistory();
            setItems([]);
          }}
        >
          Clear history
        </button>
      </div>

      <div className="history-list">
        {items.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: "40px 0", gridColumn: "1 / -1" }}>
            No detections yet. Try one of the disease pages.
          </p>
        ) : (
          items.map((it, idx) => (
            <div key={idx} className="history-item">
              <div>
                <div className="history-disease">
                  <Link href={`/diseases/${it.slug}`}>{it.name}</Link>
                </div>
                <div className="history-meta">
                  <span>{it.classification}</span>
                  <span>Confidence: {(it.confidence * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span className={`risk-pill ${it.riskLevel}`}>{it.riskLevel}</span>
                <span className="history-time">{new Date(it.at).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
