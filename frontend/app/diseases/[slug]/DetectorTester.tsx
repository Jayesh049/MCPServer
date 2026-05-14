"use client";

import { useState } from "react";
import { ImageUploader, type ImagePayload } from "../../../components/ImageUploader";
import { ClinicalForm } from "../../../components/ClinicalForm";
import { ResultPanels } from "../../../components/ResultPanels";
import { CarePlanPanel } from "../../../components/CarePlanPanel";
import { ReportAnalyzerPanel } from "../../../components/ReportAnalyzerPanel";
import { fetchCarePlan, predictDisease } from "../../../lib/api";
import { appendHistory } from "../../../lib/history";
import type { CarePlan, DiseasePipelineResult, DiseaseSummary } from "../../../lib/types";

export function DetectorTester({ disease }: { disease: DiseaseSummary }) {
  const [image, setImage] = useState<ImagePayload | null>(null);
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiseasePipelineResult | null>(null);
  const [carePlan, setCarePlan] = useState<CarePlan | null>(null);
  const [carePlanLoading, setCarePlanLoading] = useState(false);
  const [carePlanError, setCarePlanError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCarePlan(null);
    setCarePlanError(null);
    try {
      const body =
        disease.inputSpec.kind === "image"
          ? image
            ? {
                imageBase64: image.imageBase64,
                imageMimeType: image.imageMimeType,
                imageByteLength: image.imageByteLength
              }
            : null
          : { form };

      if (!body) {
        setError("Please upload an image first.");
        setLoading(false);
        return;
      }

      const r = await predictDisease(disease.slug, body);
      setResult(r);
      setCarePlan(r.carePlan ?? null);
      setCarePlanError(null);
      appendHistory(r);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="detail">
      <div className="panel">
        <div className="det-section-title">Input</div>
        {disease.inputSpec.kind === "image" ? (
          <ImageUploader acceptedMimeTypes={disease.inputSpec.acceptedMimeTypes} onChange={setImage} />
        ) : (
          <ClinicalForm fields={disease.inputSpec.fields} onChange={setForm} />
        )}

        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <button type="button" className="btn-primary" onClick={run} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Running…
              </>
            ) : (
              "Run detection"
            )}
          </button>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      <div className="detail-stack">
        {result ? (
          <ResultPanels data={result} />
        ) : (
          <div className="panel">
            <div className="det-section-title">Result</div>
            <p className="subtle">
              Provide input on the left and click <strong>Run detection</strong>. The pipeline will run detection →
              resolution → solution. When a known disease is detected, a care plan with exercises, top doctors +
              medications, and positive affirmations will appear below.
            </p>
          </div>
        )}

        {result && !carePlan && (
          <div className="panel">
            <div className="det-section-title">Care Plan</div>
            <p className="subtle">
              No care plan was auto-attached for this prediction (the result looks normal/low-risk). You can still load
              the synthetic care plan for <strong>{disease.name}</strong> on demand.
            </p>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-primary"
                disabled={carePlanLoading}
                onClick={async () => {
                  setCarePlanLoading(true);
                  setCarePlanError(null);
                  try {
                    const plan = await fetchCarePlan(disease.slug);
                    setCarePlan(plan);
                  } catch (e: any) {
                    setCarePlanError(e?.message ?? "Failed to load care plan.");
                  } finally {
                    setCarePlanLoading(false);
                  }
                }}
              >
                {carePlanLoading ? "Loading…" : "Load care plan"}
              </button>
            </div>
            {carePlanError && <div className="error" style={{ marginTop: 10 }}>{carePlanError}</div>}
          </div>
        )}

        {carePlan && <CarePlanPanel plan={carePlan} />}

        <ReportAnalyzerPanel />
      </div>
    </div>
  );
}
