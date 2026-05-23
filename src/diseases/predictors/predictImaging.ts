import { calculateImagingRisk } from "../riskCalculator.js";
import type { DiseasePredictInput, Prediction } from "../types.js";
import {
  imagingSklearnToPrediction,
  isImagingSklearnModelAvailable,
  predictImagingSklearnImage
} from "./imagingSklearn.js";

export type ImagingPredictOpts = {
  slug: string;
  positiveLabel: string;
  negativeLabel: string;
  rationaleBase: string;
};

/**
 * Imaging pipeline:
 * 1. Self-trained sklearn (HOG+histogram) if artifact exists
 * 2. Flask DISEASE_ML_URL sidecar
 * 3. Content-aware stub (clearly labelled)
 */
export async function predictImagingDisease(
  opts: ImagingPredictOpts,
  input: DiseasePredictInput
): Promise<Prediction> {
  const { slug, positiveLabel, negativeLabel, rationaleBase } = opts;

  if (input.imageBase64 && isImagingSklearnModelAvailable(slug)) {
    const ml = await predictImagingSklearnImage(slug, input.imageBase64);
    const pred = imagingSklearnToPrediction(
      ml,
      positiveLabel,
      negativeLabel,
      rationaleBase
    );
    if (pred) return pred;
  }

  const r = await calculateImagingRisk(slug, positiveLabel, negativeLabel, input);
  return {
    classification: r.classification,
    confidence: r.confidence,
    riskLevel: r.riskLevel,
    signals: r.signals.map((s) => ({ label: s.label, value: s.value })),
    rationale: r.isStub
      ? `${rationaleBase} ${r.rationale}`
      : `${rationaleBase} ${r.rationale}`
  };
}

/** Factory for registry DiseaseConfig.predict */
export function imagingMlPredict(opts: ImagingPredictOpts) {
  return (input: DiseasePredictInput) => predictImagingDisease(opts, input);
}
