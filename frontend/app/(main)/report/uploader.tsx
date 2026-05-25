"use client";

import { useState } from "react";
import { analyzeReportPdf } from "../../../lib/api";
import type { ReportAnalysisResult } from "../../../lib/types";
import { ReportFlashCards } from "../../../components/ReportFlashCards";
import { ReportDetectedList } from "../../../components/ReportDetectedList";

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

export function ReportUploader() {
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
      const r = await analyzeReportPdf({ pdfBase64: b64, pdfFilename: file.name });
      setResult(r);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="report-two-col">
      <div>
        <div className="det-section-title">PDF input</div>
        <label className="form-label">Select report PDF</label>
        <input
          className="form-input"
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ marginBottom: 12 }}
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn-primary" onClick={run} disabled={!file || loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Analyzing…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" aria-hidden>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Analyze report
              </>
            )}
          </button>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

        {!result ? (
          <div className="result-card" style={{ marginTop: 20 }}>
            <p className="subtle" style={{ margin: 0 }}>
              Upload a synthetic/de-identified PDF report and click <strong>Analyze report</strong>.
            </p>
          </div>
        ) : null}
      </div>

      <div>
        {result ? (
          <>
            <div className="det-section-title">Detected diseases</div>
            <div className="result-card" style={{ marginBottom: 16 }}>
              <ReportDetectedList
                detected={result.detectedDiseases}
                primarySlug={result.primaryDisease?.slug}
              />
            </div>

            <div className="det-section-title">Extracted text preview</div>
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
                background: "var(--mid)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 12,
                maxHeight: 340,
                overflow: "auto",
                fontSize: 12,
                color: "var(--text)",
                fontFamily: "var(--font-mono), ui-monospace, monospace"
              }}
            >
              {result.extracted.textPreview}
            </pre>

            {result.carePlan ? (
              <div style={{ marginTop: 20 }}>
                <ReportFlashCards carePlan={result.carePlan} />
              </div>
            ) : (
              <div className="result-card" style={{ marginTop: 20 }}>
                <div className="det-section-title" style={{ marginTop: 0 }}>
                  Care plan
                </div>
                <p className="subtle" style={{ margin: 0 }}>
                  No care plan available (no primary disease detected).
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
