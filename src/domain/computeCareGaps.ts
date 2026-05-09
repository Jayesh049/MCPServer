import type { NormalizedPatientFacts } from "../fhir/adapter.js";
import type { ExtractedSignals } from "../llm/extract.js";
import type { CareGap, CareGapTable } from "./careGaps.js";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function computeCareGapTable(input: {
  patientId: string;
  facts: NormalizedPatientFacts;
  signals: ExtractedSignals;
}): CareGapTable {
  const gaps: CareGap[] = [];

  const a1c = input.facts.labs.a1c?.value;
  if (a1c != null && a1c >= 8.5) {
    gaps.push({
      gapId: "gap-glycemic-control",
      title: "Poor glycemic control (elevated A1c)",
      severity: a1c >= 9 ? "high" : "medium",
      confidence: clamp01(0.65 + (a1c - 8.5) / 4),
      due: "Now",
      evidence: [
        {
          source: "fhir",
          snippet: `Latest A1c is ${a1c}${input.facts.labs.a1c?.unit ?? "%"}.`
        }
      ],
      recommendedAction:
        "Schedule diabetes follow-up, review medication adherence, and consider therapy intensification per local guidelines.",
      impactHypothesis:
        "Improves time-to-intervention for uncontrolled diabetes, reducing downstream complications and avoidable utilization."
    });
  }

  const bp = input.facts.labs.bp;
  if (bp?.systolic != null && bp?.diastolic != null && (bp.systolic >= 140 || bp.diastolic >= 90)) {
    gaps.push({
      gapId: "gap-bp-control",
      title: "Blood pressure above goal",
      severity: bp.systolic >= 160 || bp.diastolic >= 100 ? "high" : "medium",
      confidence: 0.8,
      due: "2-4 weeks",
      evidence: [
        {
          source: "fhir",
          snippet: `Recent BP ${bp.systolic}/${bp.diastolic}${bp.unit} on ${bp.effectiveDate}.`
        }
      ],
      recommendedAction:
        "Arrange BP re-check, reinforce lifestyle measures, and review antihypertensive regimen/tolerability.",
      impactHypothesis:
        "Reduces clinician time spent manually scanning vitals and improves control rates by accelerating follow-up."
    });
  }

  const ldl = input.facts.labs.ldl?.value;
  if (ldl != null && ldl >= 130) {
    gaps.push({
      gapId: "gap-hyperlipidemia",
      title: "LDL above goal",
      severity: ldl >= 160 ? "high" : "medium",
      confidence: clamp01(0.7 + (ldl - 130) / 100),
      due: "4-8 weeks",
      evidence: [
        {
          source: "fhir",
          snippet: `Latest LDL is ${ldl}${input.facts.labs.ldl?.unit ?? "mg/dL"} on ${input.facts.labs.ldl?.effectiveDate}.`
        }
      ],
      recommendedAction:
        "Review statin eligibility and adherence; consider initiating or intensifying lipid therapy per guidelines.",
      impactHypothesis:
        "Improves preventive care consistency by surfacing actionable lipid gaps at the point of decision-making."
    });
  }

  if (input.signals.missedFollowUps) {
    gaps.push({
      gapId: "gap-missed-followup",
      title: "Missed follow-up appointments / access barrier",
      severity: "medium",
      confidence: 0.7,
      due: "Now",
      evidence: [
        {
          source: "note",
          snippet:
            "Patient mentions missed follow-ups and transportation barriers (synthetic note signal)."
        }
      ],
      recommendedAction:
        "Offer care coordination (transport assistance/telehealth), and proactively reschedule follow-up.",
      impactHypothesis:
        "Saves staff time by turning unstructured access-barrier notes into actionable follow-up steps."
    });
  }

  if (input.signals.medicationSideEffect?.length) {
    gaps.push({
      gapId: "gap-med-tolerability",
      title: "Possible medication side effect impacting adherence",
      severity: "low",
      confidence: 0.55,
      due: "Next visit",
      evidence: input.signals.medicationSideEffect.map((s) => ({
        source: "note",
        snippet: `Symptom '${s.symptom}' after '${s.medication}' (synthetic note signal).`
      })),
      recommendedAction:
        "Assess symptom timing, consider alternate agent/dose adjustment, and document shared decision-making.",
      impactHypothesis:
        "Improves adherence and reduces avoidable discontinuation by prompting tolerability review."
    });
  }

  const summary =
    gaps.length === 0
      ? "No major care gaps detected from synthetic data."
      : `Detected ${gaps.length} potential care gaps from synthetic FHIR facts + note signals.`;

  return {
    patientId: input.patientId,
    generatedAt: new Date().toISOString(),
    gaps,
    summary
  };
}

