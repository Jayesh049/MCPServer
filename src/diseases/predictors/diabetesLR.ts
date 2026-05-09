import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { predictWithLR, type LRModel } from "../../training/logisticRegression.js";
import { bandToRiskLevel, bool, num } from "../helpers.js";
import type { DiseasePredictInput, Prediction } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedModel: LRModel | null | undefined;

export async function loadDiabetesModel(): Promise<LRModel | null> {
  if (cachedModel !== undefined) return cachedModel;

  const candidates = [
    // When fixtures/models are colocated next to compiled JS.
    path.join(__dirname, "..", "models", "diabetes-lr.json"),
    // When running via tsx against `src/`.
    path.join(process.cwd(), "src", "diseases", "models", "diabetes-lr.json")
  ];

  for (const c of candidates) {
    try {
      const raw = await fs.readFile(c, "utf8");
      cachedModel = JSON.parse(raw) as LRModel;
      return cachedModel;
    } catch {
      // try next
    }
  }
  cachedModel = null;
  return null;
}

export async function isDiabetesModelLoaded(): Promise<boolean> {
  return Boolean(await loadDiabetesModel());
}

export async function predictDiabetesLR(input: DiseasePredictInput): Promise<Prediction> {
  const f = input.form ?? {};
  const features = {
    age: num(f, "age"),
    bmi: num(f, "bmi"),
    fastingGlucose: num(f, "fastingGlucose"),
    a1c: num(f, "a1c"),
    familyHistory: bool(f, "familyHistory") ? 1 : 0
  };

  const model = await loadDiabetesModel();

  if (!model) {
    // Fallback: use the original deterministic rule scoring.
    let score = 0;
    if (features.a1c >= 6.5 || features.fastingGlucose >= 126) score = 0.9;
    else if (features.a1c >= 5.7 || features.fastingGlucose >= 100) score = 0.6;
    else score = 0.2;
    if (features.bmi >= 30) score += 0.1;
    if (features.age >= 45) score += 0.05;
    if (features.familyHistory) score += 0.05;
    score = Math.min(1, score);
    return {
      classification:
        score >= 0.85 ? "diabetes" : score >= 0.5 ? "prediabetes" : "normal",
      confidence: 0.6,
      riskLevel: bandToRiskLevel(score),
      signals: [
        { label: "Mode", value: "rule_fallback" },
        { label: "A1c", value: features.a1c },
        { label: "Fasting glucose", value: features.fastingGlucose },
        { label: "BMI", value: features.bmi }
      ],
      rationale:
        "Self-trained model not found; used rule-based fallback. Run `npm run train:diabetes` to enable the trained model."
    };
  }

  const { probability } = predictWithLR(model, features);
  const cls =
    probability >= 0.7 ? "diabetes" : probability >= 0.4 ? "prediabetes" : "normal";

  return {
    classification: cls,
    confidence: Math.min(1, Math.max(probability, 1 - probability)),
    riskLevel: bandToRiskLevel(probability),
    signals: [
      { label: "Mode", value: "self_trained_logistic_regression" },
      { label: "Predicted probability", value: Number(probability.toFixed(3)) },
      { label: "Holdout accuracy", value: Number(model.metrics.holdoutAccuracy.toFixed(3)) },
      { label: "Training size", value: model.trainingSize },
      { label: "A1c", value: features.a1c },
      { label: "Fasting glucose", value: features.fastingGlucose },
      { label: "BMI", value: features.bmi }
    ],
    rationale:
      `Self-trained logistic regression on synthetic diabetes-risk data ` +
      `(holdout accuracy ${model.metrics.holdoutAccuracy.toFixed(3)}). ` +
      `Trained at ${model.trainedAt}.`
  };
}
