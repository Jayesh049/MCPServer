import type { DiseaseSummary } from "./types";

export type TrainingPill = { className: string; label: string };

export function trainingPill(d: DiseaseSummary): TrainingPill {
  if (d.slug === "pneumonia") {
    return { className: "tp-hf", label: "HF API" };
  }
  if (d.category === "clinical" && d.modelKind !== "stub") {
    if (d.slug === "heart-disease") return { className: "tp-rule", label: "Framingham" };
    if (d.slug === "kidney-disease") return { className: "tp-rule", label: "CKD-EPI" };
    if (d.slug === "liver-disease") return { className: "tp-rule", label: "NAFLD" };
    if (d.slug === "hypertension") return { className: "tp-rule", label: "ACC/AHA" };
    if (d.slug === "stroke") return { className: "tp-rule", label: "CHA₂DS₂" };
    if (d.slug === "diabetes") return { className: "tp-rule", label: "formula" };
    return { className: "tp-rule", label: "formula" };
  }
  if (d.category === "signal" || d.modelKind === "stub") {
    if (d.category === "signal") {
      if (d.slug === "sleep-apnea") return { className: "tp-none", label: "STOP-BANG" };
      return { className: "tp-none", label: "heuristic" };
    }
    return { className: "tp-stub", label: "stub" };
  }
  if (d.modelKind === "open-source-pretrained") {
    return { className: "tp-hf", label: "pretrained" };
  }
  if (d.modelKind === "self-trained") {
    return { className: "tp-rule", label: "trained" };
  }
  return { className: "tp-stub", label: "stub" };
}
