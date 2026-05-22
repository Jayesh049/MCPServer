import { calculateImagingRisk } from "../riskCalculator.js";
import { bandToRiskLevel } from "../helpers.js";
import type { DiseasePredictInput, Prediction } from "../types.js";
import { predictTuberculosisHF } from "./tuberculosisHF.js";
import {
  isTbSklearnModelAvailable,
  predictTbSklearnText,
  tbSklearnToPrediction
} from "./tuberculosisSklearn.js";

/**
 * Tuberculosis pipeline (TB2.pdf–trained sklearn + optional HF CXR):
 * 1. reportText / form.reportText → sklearn TF-IDF + LR/RF
 * 2. chest X-ray image → Hugging Face (HF_TB_MODEL_ID) if HF_API_TOKEN set
 * 3. else imagingRiskPredict stub / DISEASE_ML_URL sidecar
 */
export async function predictTuberculosis(input: DiseasePredictInput): Promise<Prediction> {
  const reportText =
    (typeof input.form?.reportText === "string" && input.form.reportText) ||
    (typeof input.form?.clinicalText === "string" && input.form.clinicalText) ||
    "";

  if (reportText.trim().length >= 20 && isTbSklearnModelAvailable()) {
    const ml = await predictTbSklearnText(reportText);
    const pred = tbSklearnToPrediction(ml, "Report/clinical text analysis.");
    if (pred) return pred;
  }

  if (input.imageBase64) {
    const hfPred = await predictTuberculosisHF(input);
    if (hfPred) return hfPred;

    const r = await calculateImagingRisk(
      "tuberculosis",
      "tb_findings_suspected",
      "no_tb_findings",
      input
    );
    const score =
      r.classification === "tb_findings_suspected"
        ? 0.5 + r.confidence * 0.5
        : 0.5 - r.confidence * 0.5;

    return {
      classification: r.classification,
      confidence: r.confidence,
      riskLevel: r.riskLevel,
      signals: r.signals.map((s) => ({ label: s.label, value: s.value })),
      rationale: r.isStub
        ? `${r.rationale} Set HF_API_TOKEN + HF_TB_MODEL_ID for open-source CXR model, or DISEASE_ML_URL for Flask ML.`
        : r.rationale
    };
  }

  return {
    classification: "insufficient_input",
    confidence: 0.1,
    riskLevel: bandToRiskLevel(0.2),
    signals: [
      { label: "Hint", value: "Provide chest X-ray image and/or reportText in form" }
    ],
    rationale:
      "No image or report text. Upload CXR and/or clinical report text. " +
      "Run npm run train:tb2-ml for sklearn model from TB2.pdf."
  };
}
