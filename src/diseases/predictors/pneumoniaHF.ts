import {
  classifyImageWithHF,
  isHFConfigured,
  HuggingFaceUnavailableError
} from "../../llm/huggingface.js";
import {
  bandToRiskLevel,
  deterministicScoreFromImage
} from "../helpers.js";
import type { DiseasePredictInput, Prediction } from "../types.js";

const POSITIVE_KEYWORDS = ["pneumonia", "abnormal", "opacity"];

function looksPositive(label: string): boolean {
  const l = label.toLowerCase();
  return POSITIVE_KEYWORDS.some((k) => l.includes(k));
}

export async function predictPneumonia(input: DiseasePredictInput): Promise<Prediction> {
  const fallbackScore = deterministicScoreFromImage(input);
  const fallbackPositive = fallbackScore >= 0.5;

  const fallbackPrediction = (
    reason: string,
    rationaleSuffix: string
  ): Prediction => ({
    classification: fallbackPositive ? "pneumonia_findings" : "normal_chest_xray",
    confidence: Math.abs(fallbackScore - 0.5) * 2,
    riskLevel: bandToRiskLevel(fallbackScore),
    signals: [
      { label: "Imaging-derived risk score (fallback)", value: Number(fallbackScore.toFixed(3)) },
      { label: "Image bytes received", value: input.imageByteLength ?? 0 },
      { label: "Fallback reason", value: reason }
    ],
    rationale:
      `Pneumonia detection from chest X-ray. ${rationaleSuffix} Used deterministic ` +
      `image-hash fallback for safe synthetic-data testing (no PHI).`
  });

  if (!input.imageBase64) {
    return fallbackPrediction("no_image_provided", "No image bytes were provided.");
  }

  if (!isHFConfigured()) {
    return fallbackPrediction(
      "hf_not_configured",
      "HuggingFace token not set."
    );
  }

  const modelId =
    process.env.HF_PNEUMONIA_MODEL_ID ??
    "lxyuan/vit-xray-pneumonia-classification";

  try {
    const hf = await classifyImageWithHF(
      modelId,
      input.imageBase64,
      input.imageMimeType
    );

    const top = hf.predictions[0];
    if (!top) return fallbackPrediction("hf_empty", "HuggingFace returned no labels.");
    const positiveItem =
      hf.predictions.find((p) => looksPositive(p.label)) ?? top;
    const positive = looksPositive(top.label);
    const score = positiveItem.score;

    return {
      classification: positive ? "pneumonia_findings" : "normal_chest_xray",
      confidence: Math.min(1, Math.max(0, score)),
      riskLevel: bandToRiskLevel(score),
      signals: [
        { label: "HuggingFace model", value: modelId },
        { label: "Top label", value: top.label },
        { label: "Top score", value: Number(top.score.toFixed(3)) },
        { label: "Positive-class score", value: Number(positiveItem.score.toFixed(3)) }
      ],
      rationale:
        `Pneumonia detection from chest X-ray using HuggingFace Inference API ` +
        `(model: ${modelId}). Top label: "${top.label}".`
    };
  } catch (e) {
    const reason =
      e instanceof HuggingFaceUnavailableError
        ? `hf_error_${e.status ?? "unknown"}`
        : "hf_unexpected_error";
    return fallbackPrediction(
      reason,
      e instanceof Error ? `HuggingFace call failed: ${e.message}.` : "HuggingFace call failed."
    );
  }
}
