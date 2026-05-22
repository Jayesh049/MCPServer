import type { DiseasePredictInput, Prediction } from "./types.js";
import {
  calculateClinicalRisk,
  calculateImagingRisk,
  type RiskResult
} from "./riskCalculator.js";

function riskResultToPrediction(r: RiskResult): Prediction {
  return {
    classification: r.classification,
    confidence: r.confidence,
    riskLevel: r.riskLevel,
    signals: r.signals.map((s) => ({ label: s.label, value: s.value })),
    rationale: r.rationale
  };
}

/** Clinical form diseases (Framingham, CKD-EPI, etc.). */
export function clinicalRiskPredict(slug: string) {
  return (input: DiseasePredictInput) =>
    riskResultToPrediction(calculateClinicalRisk(slug, input.form ?? {}));
}

/** Imaging diseases — content-aware stub or Flask ML sidecar. */
export function imagingRiskPredict(
  slug: string,
  positiveLabel: string,
  negativeLabel: string,
  rationaleBase: string
) {
  return async (input: DiseasePredictInput) => {
    const r = await calculateImagingRisk(slug, positiveLabel, negativeLabel, input);
    const pred = riskResultToPrediction(r);
    if (r.isStub) {
      pred.rationale = `${rationaleBase} ${r.rationale}`;
    }
    return pred;
  };
}
