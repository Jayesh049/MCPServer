import { createHash } from "node:crypto";
import type {
  DiseasePredictInput,
  Prediction,
  RiskLevel,
  Solution,
  TreatmentStep
} from "./types.js";

export function deterministicScoreFromImage(input: DiseasePredictInput): number {
  const seed =
    input.imageHash ??
    (input.imageBase64
      ? createHash("sha1").update(input.imageBase64).digest("hex")
      : null);

  if (!seed) return 0.5;

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  // Map to 0..1 deterministically.
  return ((hash % 10000) + 1) / 10000;
}

export function bandToRiskLevel(score: number): RiskLevel {
  if (score >= 0.66) return "high";
  if (score >= 0.33) return "medium";
  return "low";
}

export function getTreatmentSteps(
  treatments: TreatmentStep[],
  risk: RiskLevel
): string[] {
  return (
    treatments.find((t) => t.forRiskLevel === risk)?.steps ??
    treatments[0]?.steps ??
    []
  );
}

export function buildGenericSolution(
  prediction: Prediction,
  patientEducation: string[]
): Solution {
  const immediate: string[] = [];
  const followUp: string[] = [];

  if (prediction.riskLevel === "high") {
    immediate.push("Escalate to a clinician for prompt evaluation.");
    immediate.push("Document findings in the patient record / EHR.");
    followUp.push("Schedule confirmatory testing within 1-2 weeks.");
  } else if (prediction.riskLevel === "medium") {
    immediate.push("Schedule a clinician review within the next visit.");
    followUp.push("Repeat assessment in 4-8 weeks.");
  } else {
    immediate.push("No urgent action; continue routine monitoring.");
    followUp.push("Re-evaluate at next routine encounter.");
  }

  return {
    immediateActions: immediate,
    followUp,
    patientEducation
  };
}

export function num(form: Record<string, unknown> | undefined, key: string): number {
  const v = form?.[key];
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

export function str(form: Record<string, unknown> | undefined, key: string): string {
  const v = form?.[key];
  return v == null ? "" : String(v);
}

export function bool(
  form: Record<string, unknown> | undefined,
  key: string
): boolean {
  const v = form?.[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "yes";
  if (typeof v === "number") return v !== 0;
  return false;
}
