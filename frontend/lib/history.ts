import type { DiseasePipelineResult } from "./types";

const KEY = "agents-assemble-history";

export type HistoryItem = {
  at: string;
  slug: string;
  name: string;
  classification: string;
  riskLevel: "low" | "medium" | "high";
  confidence: number;
};

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryItem[];
  } catch {
    return [];
  }
}

export function appendHistory(result: DiseasePipelineResult) {
  if (typeof window === "undefined") return;
  const list = loadHistory();
  list.unshift({
    at: new Date().toISOString(),
    slug: result.disease.slug,
    name: result.disease.name,
    classification: result.detection.classification,
    riskLevel: result.detection.riskLevel,
    confidence: result.detection.confidence
  });
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
