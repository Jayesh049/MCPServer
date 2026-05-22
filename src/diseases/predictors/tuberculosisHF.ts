import {
  classifyImageWithHF,
  isHFConfigured,
  HuggingFaceUnavailableError
} from "../../llm/huggingface.js";
import { bandToRiskLevel } from "../helpers.js";
import type { DiseasePredictInput, Prediction } from "../types.js";

const POSITIVE_KEYWORDS = [
  "tuberculosis",
  "tb",
  "mycobacterium",
  "active_tb",
  "latent_tb",
  "abnormal",
  "disease"
];

const NORMAL_KEYWORDS = ["normal", "healthy", "no finding", "negative", "clear"];

function looksPositive(label: string): boolean {
  const l = label.toLowerCase();
  if (NORMAL_KEYWORDS.some((k) => l.includes(k))) return false;
  return POSITIVE_KEYWORDS.some((k) => l.includes(k));
}

export async function predictTuberculosisHF(
  input: DiseasePredictInput
): Promise<Prediction | null> {
  if (!input.imageBase64 || !isHFConfigured()) return null;

  const modelId =
    process.env.HF_TB_MODEL_ID?.trim() ||
    "fadams/Tuberculosis-Normal-Chest-X-ray";

  try {
    const hf = await classifyImageWithHF(
      modelId,
      input.imageBase64,
      input.imageMimeType
    );
    const sorted = [...hf.predictions].sort((a, b) => b.score - a.score);
    const top = sorted[0];
    if (!top) return null;

    const positive = looksPositive(top.label);
    const score = positive ? top.score : 1 - top.score;

    return {
      classification: positive ? "tb_findings_suspected" : "no_tb_findings",
      confidence: Math.min(1, Math.max(score, sorted[1]?.score ?? 0)),
      riskLevel: bandToRiskLevel(score),
      signals: [
        { label: "HF model", value: modelId },
        { label: "Top label", value: top.label },
        { label: "Top score", value: Number(top.score.toFixed(4)) }
      ],
      rationale:
        `Open-source Hugging Face chest X-ray model (${modelId}). ` +
        `Top prediction: ${top.label} (${(top.score * 100).toFixed(1)}%). Educational only.`
    };
  } catch (e) {
    if (e instanceof HuggingFaceUnavailableError) return null;
    throw e;
  }
}
