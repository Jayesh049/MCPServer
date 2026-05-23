"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ClinicalForm } from "../ClinicalForm";
import { fetchCarePlan, predictDisease } from "../../lib/api";
import { diseaseIcon } from "../../lib/disease-icons";
import { appendHistory } from "../../lib/history";
import type { CarePlan, DiseasePipelineResult, DiseaseSummary } from "../../lib/types";
import { StunningCarePlan } from "./StunningCarePlan";
import { StunningResultPanels } from "./StunningResultPanels";

type ImagePayload = {
  imageBase64: string;
  imageMimeType: string;
  imageByteLength: number;
  fileName: string;
};

export function StunningDiseaseDetector({ disease }: { disease: DiseaseSummary }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<ImagePayload | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiseasePipelineResult | null>(null);
  const [carePlan, setCarePlan] = useState<CarePlan | null>(null);
  const [carePlanLoading, setCarePlanLoading] = useState(false);

  async function handleImage(file: File) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    setFileLabel(file.name);
    setImage({
      imageBase64: btoa(binary),
      imageMimeType: file.type,
      imageByteLength: file.size,
      fileName: file.name
    });
  }

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCarePlan(null);
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
      appendHistory(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="sec-h">
        <div>
          <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{diseaseIcon(disease.slug, disease.category)}</span>
            {disease.name}
          </div>
          <div className="sec-sub">{disease.description}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <span className="src-pill">{disease.modality}</span>
          <span className="src-pill dim">{disease.modelKind}</span>
        </div>
      </div>

      <p className="disc" style={{ marginTop: 0, marginBottom: 18 }}>
        {disease.modelNotes} · Synthetic / non-PHI only.{" "}
        <Link href="/" style={{ color: "var(--acc)" }}>
          ← Disease hub
        </Link>{" "}
        ·{" "}
        <Link href="/report" style={{ color: "var(--acc)" }}>
          Report analyzer
        </Link>
      </p>

      <div className="two-col">
        <div>
          <div className="sec-lbl">Input</div>
          {disease.inputSpec.kind === "image" ? (
            <>
              <div
                className={`upz${fileLabel ? " has" : ""}`}
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
                  accept={disease.inputSpec.acceptedMimeTypes.join(",")}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImage(f);
                  }}
                />
                <div className="up-icon">🖼</div>
                <div className="up-t">{fileLabel ?? "Upload imaging sample"}</div>
                <div className="up-h">
                  {fileLabel
                    ? "Click to replace"
                    : `Accepted: ${disease.inputSpec.acceptedMimeTypes.join(", ")}`}
                </div>
              </div>
              {fileLabel ? (
                <button
                  type="button"
                  className="btn btn-g"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setImage(null);
                    setFileLabel(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  Clear image
                </button>
              ) : null}
            </>
          ) : (
            <ClinicalForm fields={disease.inputSpec.fields} onChange={setForm} variant="stunning" />
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-p" style={{ flex: 1 }} onClick={() => void run()} disabled={loading}>
              {loading ? <span className="spin" /> : null}
              Run detection
            </button>
          </div>
          {error ? <p style={{ color: "var(--rose)", fontSize: 12, marginTop: 10 }}>{error}</p> : null}
        </div>

        <div>
          <div className="sec-lbl">Pipeline output</div>
          {result ? (
            <StunningResultPanels data={result} />
          ) : (
            <div className="pipe-card">
              <p style={{ fontSize: 12, color: "var(--txt3)", lineHeight: 1.6, margin: 0 }}>
                Provide input and run <strong style={{ color: "var(--txt2)" }}>detection → resolution → solution</strong>.
                A synthetic care plan appears below when the model flags elevated risk.
              </p>
            </div>
          )}
        </div>
      </div>

      {result && !carePlan ? (
        <div className="pipe-card" style={{ marginBottom: 16 }}>
          <div className="sec-lbl">Care plan</div>
          <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 10 }}>
            No care plan was auto-attached (low/normal risk). Load the synthetic plan for{" "}
            <strong style={{ color: "var(--txt)" }}>{disease.name}</strong> on demand.
          </p>
          <button
            type="button"
            className="btn btn-g"
            disabled={carePlanLoading}
            onClick={async () => {
              setCarePlanLoading(true);
              try {
                const plan = await fetchCarePlan(disease.slug);
                setCarePlan(plan);
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Failed to load care plan.");
              } finally {
                setCarePlanLoading(false);
              }
            }}
          >
            {carePlanLoading ? <span className="spin" /> : null}
            Load care plan
          </button>
        </div>
      ) : null}

      {carePlan ? <StunningCarePlan plan={carePlan} /> : null}
    </>
  );
}
