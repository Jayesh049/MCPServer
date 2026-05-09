"use client";

import { useState } from "react";
import { analyzeReportFile } from "../lib/api";
import type { ReportAnalysisResult } from "../lib/types";
import { CarePlanPanel } from "./CarePlanPanel";

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => {
      const res = reader.result;
      if (typeof res !== "string") return reject(new Error("Unexpected read result."));
      const idx = res.indexOf(",");
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.readAsDataURL(file);
  });
}

export function ReportAnalyzerPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportAnalysisResult | null>(null);

  async function run() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const b64 = await toBase64(file);
      const r = await analyzeReportFile({ fileBase64: b64, filename: file.name });
      setResult(r);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="panel">
        <h2>Report analysis (PDF / Excel / CSV)</h2>
        <p className="subtle">
          Upload a synthetic / de-identified report. The backend extracts text, runs
          keyword-based disease matching, then returns details + a synthetic care plan.
        </p>
        <label className="label" style={{ marginTop: 10 }}>
          Select report file
        </label>
        <input
          className="input"
          type="file"
          accept="application/pdf,.xlsx,.xls,text/csv,.csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button className="btn" onClick={run} disabled={!file || loading}>
            {loading ? "Analyzing…" : "Analyze report"}
          </button>
          {result ? (
            <button className="btn secondary" onClick={() => setResult(null)} disabled={loading}>
              Clear
            </button>
          ) : null}
        </div>
        {error && (
          <div className="error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </div>

      {result ? (
        <>
          <div className="panel">
            <h2>Detected diseases</h2>
            {result.primaryDisease ? (
              <p className="subtle">
                Primary: <strong>{result.primaryDisease.name}</strong> (
                <code>{result.primaryDisease.slug}</code>) score{" "}
                {(result.primaryDisease.score * 100).toFixed(0)}%
              </p>
            ) : (
              <p className="subtle">No disease keywords found.</p>
            )}

            {result.detectedDiseases.length > 0 && (
              <ul className="list">
                {result.detectedDiseases.map((d) => (
                  <li key={d.slug}>
                    <strong>{d.name}</strong> <span className="subtle">({d.slug})</span> —{" "}
                    {(d.score * 100).toFixed(0)}% — evidence:{" "}
                    <span className="subtle">{d.evidence.join(", ")}</span>
                    {d.evidenceSnippets?.length ? (
                      <div className="subtle" style={{ marginTop: 6 }}>
                        Matches:
                        <ul className="list">
                          {d.evidenceSnippets.slice(0, 3).map((s, idx) => (
                            <li key={idx}>
                              <code>{s}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {result.notes?.length ? (
              <div style={{ marginTop: 10 }}>
                <div className="label">Notes</div>
                <ul className="list">
                  {result.notes.map((n, idx) => (
                    <li key={idx}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="panel">
            <h2>Extracted text preview</h2>
            <div className="subtle" style={{ marginBottom: 10 }}>
              Characters: <strong>{result.extracted.charCount}</strong>
              {result.extracted.pages ? (
                <>
                  {" "}
                  — Pages: <strong>{result.extracted.pages}</strong>
                </>
              ) : null}
            </div>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 12,
                maxHeight: 340,
                overflow: "auto",
                fontSize: 12,
                color: "var(--text)"
              }}
            >
              {result.extracted.textPreview}
            </pre>
          </div>

          {result.carePlan ? (
            <CarePlanPanel plan={result.carePlan} />
          ) : (
            <div className="panel">
              <h2>Care plan</h2>
              <p className="subtle">
                No care plan available (no primary disease detected).
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

