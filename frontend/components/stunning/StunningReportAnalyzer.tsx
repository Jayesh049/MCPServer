"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { analyzeReportPdf, fetchCarePlan } from "../../lib/api";
import { demoReportResult } from "../../lib/report-demo";
import type { CarePlan, DiseaseHit, ReportAnalysisResult } from "../../lib/types";
import { HealthFlashcardsReport } from "../HealthFlashcardsReport";

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

function HitList({
  hits,
  primarySlug
}: {
  hits: DiseaseHit[];
  primarySlug?: string | null;
}) {
  if (hits.length === 0) {
    return (
      <div style={{ color: "var(--txt3)", fontSize: 12, padding: "10px 0" }}>
        Upload a report or click Demo data.
      </div>
    );
  }
  return (
    <div className="hl">
      {hits.map((h) => (
        <div key={h.slug} className={`hi ${h.slug === primarySlug ? "pri" : ""}`}>
          <div className="hi-bar">
            <div className="hi-fill" style={{ width: `${Math.round(h.score * 100)}%` }} />
          </div>
          <div className="hi-score">{Math.round(h.score * 100)}%</div>
          <div>
            <div className="hi-n">
              {h.name}
              {h.slug === primarySlug ? " ★" : ""}
            </div>
            <div className="hi-e">{(h.evidence ?? []).slice(0, 4).join(" · ")}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StunningReportAnalyzer() {
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [b64, setB64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportAnalysisResult | null>(null);
  const [hubHits, setHubHits] = useState<DiseaseHit[] | null>(null);

  const applyResult = useCallback((data: ReportAnalysisResult, extraHits?: DiseaseHit[] | null) => {
    setResult(data);
    setHubHits(extraHits ?? null);
    setError(null);
  }, []);

  useEffect(() => {
    const from = searchParams.get("from");
    const slug = searchParams.get("slug");
    if (from === "hub") {
      try {
        const raw = sessionStorage.getItem("stunning_hub_pick");
        if (raw) {
          const parsed = JSON.parse(raw) as {
            slug: string;
            name: string;
            plan: CarePlan;
            hits: DiseaseHit[];
          };
          applyResult(
            {
              extracted: { charCount: 0, textPreview: "" },
              detectedDiseases: parsed.hits,
              primaryDisease: parsed.hits[0] ?? null,
              carePlan: parsed.plan,
              notes: []
            },
            parsed.hits
          );
          sessionStorage.removeItem("stunning_hub_pick");
          return;
        }
      } catch {
        /* ignore */
      }
    }
    if (slug) {
      void fetchCarePlan(slug).then((plan) => {
        const name = plan.diseaseName;
        const hit: DiseaseHit = {
          slug,
          name,
          score: 1,
          evidence: ["Loaded from disease hub"],
          evidenceSnippets: []
        };
        applyResult(
          {
            extracted: { charCount: 0, textPreview: "" },
            detectedDiseases: [hit],
            primaryDisease: hit,
            carePlan: plan,
            notes: []
          },
          [hit]
        );
      });
    }
  }, [searchParams, applyResult]);

  function onFileChange(f: File | undefined) {
    if (!f) return;
    setFile(f);
    void toBase64(f).then(setB64);
  }

  async function analyze() {
    if (!b64) return;
    setLoading(true);
    setError(null);
    setHubHits(null);
    try {
      const data = await analyzeReportPdf({
        pdfBase64: b64,
        pdfFilename: file?.name
      });
      applyResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
      applyResult(demoReportResult());
      const slug = "liver-disease";
      try {
        const plan = await fetchCarePlan(slug);
        setResult((prev) => (prev ? { ...prev, carePlan: plan } : prev));
      } catch {
        /* demo without plan */
      }
    } finally {
      setLoading(false);
    }
  }

  async function runDemo() {
    setLoading(true);
    setHubHits(null);
    setError(null);
    try {
      const demo = demoReportResult();
      const plan = await fetchCarePlan("liver-disease");
      applyResult({ ...demo, carePlan: plan });
    } catch {
      applyResult(demoReportResult());
    } finally {
      setLoading(false);
    }
  }

  const hits = hubHits ?? result?.detectedDiseases ?? [];
  const primarySlug = result?.primaryDisease?.slug ?? hits[0]?.slug;

  return (
    <>
      <div className="sec-h">
        <div>
          <div className="sec-title">Report Analyzer</div>
          <div className="sec-sub">Upload a PDF health report for AI-powered disease detection & care plan</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
          <span className="src-pill">📄 pdf-parse · local</span>
          <span className="src-pill rose">Synthetic · no PHI</span>
        </div>
      </div>

      <div className="two-col">
        <div>
          <div
            style={{
              fontSize: "9.5px",
              fontWeight: 600,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--txt3)",
              marginBottom: 8
            }}
          >
            PDF Input
          </div>
          <div
            className={`upz${file ? " has" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: "none" }}
              onChange={(e) => onFileChange(e.target.files?.[0])}
            />
            <div className="up-icon">📋</div>
            <div className="up-t">{file ? file.name : "Select report PDF"}</div>
            <div className="up-h">
              {file ? `${(file.size / 1024).toFixed(0)} KB` : "De-identified reports only · No PHI"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-p"
              style={{ flex: 1 }}
              disabled={!b64 || loading}
              onClick={() => void analyze()}
            >
              {loading ? <span className="spin" /> : null}
              Analyze
            </button>
            <button type="button" className="btn btn-g" style={{ flex: 1 }} disabled={loading} onClick={() => void runDemo()}>
              ▶ Demo data
            </button>
          </div>
          {error ? (
            <p style={{ color: "var(--rose)", fontSize: 12, marginTop: 8 }}>{error}</p>
          ) : null}
        </div>
        <div>
          <div
            style={{
              fontSize: "9.5px",
              fontWeight: 600,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--txt3)",
              marginBottom: 8
            }}
          >
            Detected Diseases{" "}
            <span className="src-pill dim" style={{ verticalAlign: "middle", marginLeft: 4 }}>
              keyword match
            </span>
          </div>
          <HitList hits={hits} primarySlug={primarySlug} />
        </div>
      </div>

      {result?.extracted?.textPreview ? (
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: "9.5px",
              fontWeight: 600,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--txt3)",
              marginBottom: 6
            }}
          >
            Extracted Text
          </div>
          <div
            style={{
              background: "rgba(0,0,0,.4)",
              border: "1px solid var(--bdr)",
              borderRadius: "var(--r2)",
              padding: "10px 12px",
              fontSize: 11,
              fontFamily: "var(--font-mono), monospace",
              color: "var(--txt3)",
              maxHeight: 110,
              overflowY: "auto",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap"
            }}
          >
            {result.extracted.textPreview}
          </div>
          <div style={{ fontSize: 10, color: "var(--txt3)", marginTop: 4 }}>
            Characters: {(result.extracted.charCount ?? 0).toLocaleString()}
            {result.extracted.pages ? ` — Pages: ${result.extracted.pages}` : ""}
          </div>
        </div>
      ) : null}

      {(hits.length > 0 || result?.carePlan) && (
        <HealthFlashcardsReport hits={hits} carePlan={result?.carePlan ?? null} />
      )}
    </>
  );
}
