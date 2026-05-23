import {
  classifyImageWithHF,
  isHFConfigured,
  HuggingFaceUnavailableError
} from "../../llm/huggingface.js";
import { bandToRiskLevel } from "../helpers.js";
import type { DiseasePredictInput, Prediction } from "../types.js";

const POSITIVE_KEYWORDS = ["pneumonia", "abnormal", "opacity"];
const DEFAULT_HF_MODEL = "lxyuan/vit-xray-pneumonia-classification";

function pneumoniaModelId(): string {
  return (
    process.env.HF_PNEUMONIA_MODEL_ID?.trim() ||
    process.env.HF_PNEUMONIA_MODEL?.trim() ||
    DEFAULT_HF_MODEL
  );
}

function looksPositive(label: string): boolean {
  const l = label.toLowerCase();
  return POSITIVE_KEYWORDS.some((k) => l.includes(k));
}

function stripDataUrl(b64: string): string {
  return b64.replace(/^data:[^;]+;base64,/, "");
}

/** Brightness/contrast heuristic — not a trained model; clearly labeled in rationale. */
function contentAwareScore(imageBase64: string): {
  score: number;
  brightness: number;
  contrast: number;
} {
  let brightness = 0.5;
  let contrast = 0.5;

  try {
    const buf = Buffer.from(stripDataUrl(imageBase64), "base64");
    if (buf.length > 0) {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < buf.length; i += 80) {
        sum += buf[i]! / 255;
        count++;
      }
      brightness = count > 0 ? sum / count : 0.5;

      let varSum = 0;
      for (let i = 0; i < buf.length; i += 80) {
        const v = buf[i]! / 255 - brightness;
        varSum += v * v;
      }
      contrast = Math.sqrt(varSum / Math.max(count, 1));
    }
  } catch {
    /* keep defaults */
  }

  const score = Math.max(
    0,
    Math.min(1, 0.25 + contrast * 0.5 + (1 - brightness) * 0.25)
  );
  return { score, brightness, contrast };
}

function predictionFromScore(
  score: number,
  opts: {
    provider: string;
    isStub: boolean;
    rationale: string;
    extraSignals?: Array<{ label: string; value: string | number }>;
  }
): Prediction {
  const positive = score >= 0.5;
  return {
    classification: positive ? "pneumonia_findings" : "normal_chest_xray",
    confidence: Math.abs(score - 0.5) * 2,
    riskLevel: bandToRiskLevel(score),
    signals: [
      { label: "Provider", value: opts.provider },
      { label: "isStub", value: opts.isStub ? "true" : "false" },
      { label: "Risk score", value: Number(score.toFixed(3)) },
      ...(opts.extraSignals ?? [])
    ],
    rationale: opts.rationale
  };
}

async function callFlaskSidecar(imageBase64: string): Promise<Prediction | null> {
  const baseUrl = process.env.DISEASE_ML_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/v1/diseases/pneumonia/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64 }),
      signal: AbortSignal.timeout(8_000)
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      score?: number;
      classification?: string;
      confidence?: number;
      rationale?: string;
    };

    const score = data.score ?? 0.5;
    const positive =
      data.classification?.toLowerCase().includes("pneumonia") ?? score >= 0.5;

    return predictionFromScore(positive ? score : 1 - score, {
      provider: "flask_sidecar",
      isStub: false,
      rationale:
        data.rationale ??
        `Flask sidecar prediction (DISEASE_ML_URL). Score: ${score.toFixed(3)}.`,
      extraSignals: [{ label: "Flask sidecar", value: baseUrl }]
    });
  } catch (e) {
    console.error("[pneumoniaHF] Flask sidecar failed:", e);
    return null;
  }
}

function predictionFromHF(
  modelId: string,
  predictions: Array<{ label: string; score: number }>
): Prediction {
  const pneumoniaEntry = predictions.find((p) => looksPositive(p.label));
  const normalEntry = predictions.find((p) =>
    p.label.toUpperCase().includes("NORMAL")
  );
  const top = predictions[0]!;
  const pneumoniaScore = pneumoniaEntry?.score ?? 0.5;
  const normalScore = normalEntry?.score ?? 1 - pneumoniaScore;
  const positive = pneumoniaScore >= normalScore;
  const score = positive ? pneumoniaScore : normalScore;

  return predictionFromScore(score, {
    provider: "huggingface",
    isStub: false,
    rationale:
      `Hugging Face ViT chest X-ray model (${modelId}). ` +
      `Pneumonia: ${(pneumoniaScore * 100).toFixed(1)}%, Normal: ${(normalScore * 100).toFixed(1)}%.`,
    extraSignals: [
      { label: "HuggingFace model", value: modelId },
      { label: "Top label", value: top.label },
      { label: "Top score", value: Number(top.score.toFixed(3)) }
    ]
  });
}

export async function predictPneumonia(
  input: DiseasePredictInput
): Promise<Prediction> {
  if (!input.imageBase64) {
    const { score, brightness, contrast } = contentAwareScore("");
    return predictionFromScore(score, {
      provider: "content_stub",
      isStub: true,
      rationale:
        "No image provided. Set HF_API_TOKEN for ViT inference or upload a chest X-ray.",
      extraSignals: [
        { label: "Brightness (stub)", value: Number(brightness.toFixed(3)) },
        { label: "Contrast (stub)", value: Number(contrast.toFixed(3)) }
      ]
    });
  }

  const modelId = pneumoniaModelId();

  if (isHFConfigured()) {
    try {
      const hf = await classifyImageWithHF(
        modelId,
        input.imageBase64,
        input.imageMimeType
      );
      if (hf.predictions.length > 0) {
        return predictionFromHF(modelId, hf.predictions);
      }
    } catch (e) {
      const msg =
        e instanceof HuggingFaceUnavailableError
          ? `HF error ${e.status ?? "unknown"}: ${e.message}`
          : e instanceof Error
            ? e.message
            : "HF request failed";
      console.error("[pneumoniaHF]", msg);
    }
  }

  const flask = await callFlaskSidecar(input.imageBase64);
  if (flask) return flask;

  const { score, brightness, contrast } = contentAwareScore(input.imageBase64);
  return predictionFromScore(score, {
    provider: "content_stub",
    isStub: true,
    rationale:
      "SYNTHETIC STUB — no trained model loaded. Score uses image brightness/contrast heuristics only. " +
      `brightness=${brightness.toFixed(3)}, contrast=${contrast.toFixed(3)}. ` +
      "Set HF_API_TOKEN (free, ~30k req/month at huggingface.co/settings/tokens) " +
      "or DISEASE_ML_URL for real inference.",
    extraSignals: [
      { label: "Brightness (stub)", value: Number(brightness.toFixed(3)) },
      { label: "Contrast (stub)", value: Number(contrast.toFixed(3)) }
    ]
  });
}
