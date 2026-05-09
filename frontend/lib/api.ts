import type { CarePlan, DiseasePipelineResult, DiseaseSummary, ReportAnalysisResult } from "./types";

export async function fetchDiseases(): Promise<DiseaseSummary[]> {
  const res = await fetch("/api/diseases", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load diseases (${res.status})`);
  const data = (await res.json()) as { diseases: DiseaseSummary[] };
  return data.diseases;
}

export async function predictDisease(
  slug: string,
  body: {
    imageBase64?: string;
    imageMimeType?: string;
    imageByteLength?: number;
    form?: Record<string, string | number | boolean>;
  }
): Promise<DiseasePipelineResult> {
  const res = await fetch(`/api/diseases/${slug}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as DiseasePipelineResult;
}

export async function fetchCarePlan(slug: string): Promise<CarePlan> {
  const res = await fetch(`/api/diseases/${slug}/care-plan`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to load care plan (${res.status})`);
  }
  return (await res.json()) as CarePlan;
}

export async function analyzeReportPdf(body: {
  pdfBase64: string;
  pdfFilename?: string;
}): Promise<ReportAnalysisResult> {
  const res = await fetch(`/api/report/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Report analysis failed (${res.status})`);
  }
  return (await res.json()) as ReportAnalysisResult;
}

export async function analyzeReportFile(body: {
  fileBase64: string;
  filename: string;
}): Promise<ReportAnalysisResult> {
  const res = await fetch(`/api/report/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Report analysis failed (${res.status})`);
  }
  return (await res.json()) as ReportAnalysisResult;
}
