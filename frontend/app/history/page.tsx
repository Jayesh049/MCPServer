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
      <section className="hero">
        <h1>Detection history</h1>
        <p className="subtle">
          Stored locally in your browser. Cleared with one click; nothing is sent to a
          server.
        </p>
      </section>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            className="btn secondary"
            onClick={() => {
              clearHistory();
              setItems([]);
            }}
          >
            Clear history
          </button>
        </div>

        {items.length === 0 ? (
          <p className="subtle">No detections yet. Try one of the disease pages.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                  <th style={{ padding: "8px 6px" }}>Time</th>
                  <th style={{ padding: "8px 6px" }}>Disease</th>
                  <th style={{ padding: "8px 6px" }}>Classification</th>
                  <th style={{ padding: "8px 6px" }}>Risk</th>
                  <th style={{ padding: "8px 6px" }}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 6px" }}>
                      {new Date(it.at).toLocaleString()}
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <Link href={`/diseases/${it.slug}`}>{it.name}</Link>
                    </td>
                    <td style={{ padding: "8px 6px" }}>{it.classification}</td>
                    <td style={{ padding: "8px 6px" }}>
                      <span className={`pill ${it.riskLevel}`}>{it.riskLevel}</span>
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      {(it.confidence * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
