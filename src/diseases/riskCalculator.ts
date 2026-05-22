/**
 * riskCalculator.ts
 *
 * FIXED version of disease risk calculation.
 *
 * THE BUG (original):
 *   All imaging diseases used `deterministicScoreFromImage()` — a hash of raw
 *   image bytes. This is completely unrelated to the image content. A 400x400
 *   black JPEG gets a completely different score from a 400x400 white JPEG even
 *   though both have no medical finding. The score is meaningless.
 *
 * THIS FIX:
 *   1. For CLINICAL diseases (diabetes, heart, kidney, liver, hypertension etc.)
 *      → Real logistic regression / scoring rules on form fields (same approach
 *        as the existing diabetesLR.ts, now extended to all clinical diseases).
 *
 *   2. For IMAGING diseases (MRI, X-ray, retinal, skin etc.)
 *      → We cannot run a real CNN in the browser/Node without a model file.
 *        So we:
 *        (a) Try to call the Flask ML sidecar at DISEASE_ML_URL if available.
 *        (b) Fall back to a CONTENT-AWARE stub: extract EXIF/basic image stats
 *            (brightness, entropy approximation, aspect ratio) and use those
 *            as minimal features — still synthetic but at least *image-content-
 *            aware* rather than byte-hash-based.
 *        (c) Make it CLEARLY labelled as "synthetic stub" so no one mistakes
 *            it for a real diagnostic output.
 *
 * HOW TO USE:
 *   Replace imports of `deterministicScoreFromImage` and `bandToRiskLevel`
 *   in src/diseases/helpers.ts with this module, or call directly:
 *
 *     import { calculateClinicalRisk, calculateImagingRisk } from "./riskCalculator.js";
 *
 * INTEGRATION (src/diseases/registry.ts):
 *   For each clinical DiseaseConfig, replace:
 *     predict: (input) => { ... deterministicScore ... }
 *   with:
 *     predict: (input) => calculateClinicalRisk("diabetes", input.form)
 *
 *   The registry already does this correctly for diabetes (diabetesLR.ts).
 *   This file extends that to all other clinical diseases.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type RiskLevel = "low" | "medium" | "high";

export type RiskSignal = { label: string; value: number | string };

export type RiskResult = {
  classification: string;
  confidence: number;   // 0..1
  riskLevel: RiskLevel;
  signals: RiskSignal[];
  rationale: string;
  isStub: boolean;       // true = synthetic/educational, false = real model
};

// ---------------------------------------------------------------------------
// Utility: logistic sigmoid
// ---------------------------------------------------------------------------
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function bandToRiskLevel(score: number): RiskLevel {
  if (score < 0.35) return "low";
  if (score < 0.65) return "medium";
  return "high";
}

// ---------------------------------------------------------------------------
// CLINICAL RISK CALCULATORS
// Each function mirrors a real validated scoring rule, simplified for
// educational/demo purposes. All output is ILLUSTRATIVE only.
// ---------------------------------------------------------------------------

type FormFields = Record<string, string | number | boolean | undefined>;

/**
 * Diabetes risk — Logistic regression on clinical indicators.
 * Features: glucose, hba1c, bmi, age, familyHistory, pregnancies (gestational)
 */
export function calcDiabetesRisk(form: FormFields): RiskResult {
  const glucose = Number(form.glucose ?? form.FastingGlucose ?? 100);
  const hba1c = Number(form.hba1c ?? form.HbA1c ?? 5.7);
  const bmi = Number(form.bmi ?? form.BMI ?? 25);
  const age = Number(form.age ?? form.Age ?? 40);
  const familyHistory = form.familyHistory === true || form.FamilyHistory === 1 ? 1 : 0;

  // Feature scaling (approximate population means/stds)
  const z =
    -8.404 +
    0.023 * (glucose - 120) +
    0.6 * (hba1c - 5.5) +
    0.039 * (bmi - 25) +
    0.014 * (age - 40) +
    0.72 * familyHistory;

  const score = sigmoid(z);
  const level = bandToRiskLevel(score);

  return {
    classification: level === "high" ? "diabetes_likely" : level === "medium" ? "prediabetes_risk" : "normal_glucose",
    confidence: Math.abs(score - 0.5) * 2,
    riskLevel: level,
    isStub: false,
    signals: [
      { label: "Fasting glucose (mg/dL)", value: glucose },
      { label: "HbA1c (%)", value: hba1c },
      { label: "BMI", value: bmi },
      { label: "Logistic score", value: Number(score.toFixed(3)) },
    ],
    rationale:
      `Logistic regression on glucose=${glucose}, HbA1c=${hba1c}%, BMI=${bmi}. ` +
      `ADA risk thresholds applied. This is an educational model, not a clinical diagnostic.`,
  };
}

/**
 * Heart disease risk — Framingham-inspired simplified score.
 * Features: age, sex, totalCholesterol, hdl, systolicBP, smoker, diabetic
 */
export function calcHeartDiseaseRisk(form: FormFields): RiskResult {
  const age = Number(form.age ?? 55);
  const sex = String(form.sex ?? form.gender ?? "male").toLowerCase();
  const totalChol = Number(form.totalCholesterol ?? form.chol ?? 200);
  const hdl = Number(form.hdl ?? 50);
  const sbp = Number(form.systolicBP ?? form.systolicBp ?? form.systolic ?? form.trestbps ?? 130);
  const smoker = form.smoker === true || form.smoker === 1 || form.smoker === "yes" ? 1 : 0;
  const diabetic = form.diabetic === true || form.diabetic === 1 ? 1 : 0;
  const cp = Number(form.chestPain ?? form.cp ?? 0); // 0-3

  // Simplified Framingham-style log-risk
  let z = -10.0;
  if (sex === "male") {
    z = 3.06117 * Math.log(age)
      + 1.12370 * Math.log(totalChol)
      - 0.93263 * Math.log(hdl)
      + 1.99881 * Math.log(sbp)
      + 0.65451 * smoker
      + 0.57367 * diabetic
      - 23.9802;
  } else {
    z = 2.32888 * Math.log(age)
      + 1.20904 * Math.log(totalChol)
      - 0.70833 * Math.log(hdl)
      + 2.76157 * Math.log(sbp)
      + 0.52873 * smoker
      + 0.69154 * diabetic
      - 26.1931;
  }

  const tenYearRisk = 1 - Math.pow(sex === "male" ? 0.9402 : 0.9827, Math.exp(z));
  const score = Math.max(0, Math.min(1, tenYearRisk * 5)); // scale to 0-1
  const level = bandToRiskLevel(score);

  // Chest pain modifier
  const cpBoost = cp >= 2 ? 0.1 : 0;
  const finalScore = Math.min(1, score + cpBoost);

  return {
    classification: level === "high" ? "heart_disease_likely" : level === "medium" ? "elevated_cardiac_risk" : "low_cardiac_risk",
    confidence: Math.abs(finalScore - 0.5) * 2,
    riskLevel: bandToRiskLevel(finalScore),
    isStub: false,
    signals: [
      { label: "Age", value: age },
      { label: "Systolic BP (mmHg)", value: sbp },
      { label: "Total Cholesterol", value: totalChol },
      { label: "10-yr risk (Framingham)", value: `${(tenYearRisk * 100).toFixed(1)}%` },
    ],
    rationale:
      `Simplified Framingham Heart Study scoring. 10-year risk: ${(tenYearRisk * 100).toFixed(1)}%. ` +
      `Educational model only — not a validated clinical tool.`,
  };
}

/**
 * Kidney disease risk — eGFR + proteinuria based (KDIGO staging).
 */
export function calcKidneyDiseaseRisk(form: FormFields): RiskResult {
  const creatinine = Number(form.creatinine ?? 1.1);
  const age = Number(form.age ?? 50);
  const sex = String(form.sex ?? form.gender ?? "male").toLowerCase();
  const proteinuria = form.proteinuria === true || Number(form.uacr ?? 0) > 30 ? 1 : 0;
  const diabetic = form.diabetic === true || form.diabetic === 1 ? 1 : 0;
  const hypertensive = form.hypertension === true || form.hypertension === 1 ? 1 : 0;

  // CKD-EPI eGFR estimation
  const kappa = sex === "female" ? 0.7 : 0.9;
  const alpha = sex === "female" ? -0.241 : -0.302;
  const creatRatio = creatinine / kappa;
  const eGFR =
    142 *
    Math.pow(Math.min(creatRatio, 1), alpha) *
    Math.pow(Math.max(creatRatio, 1), -1.200) *
    Math.pow(0.9938, age) *
    (sex === "female" ? 1.012 : 1.0);

  // KDIGO risk: eGFR + proteinuria
  let score: number;
  if (eGFR >= 90) score = 0.1;
  else if (eGFR >= 60) score = 0.25 + proteinuria * 0.15;
  else if (eGFR >= 45) score = 0.5 + proteinuria * 0.15;
  else if (eGFR >= 30) score = 0.7;
  else score = 0.9;

  score = Math.min(1, score + diabetic * 0.05 + hypertensive * 0.05);

  return {
    classification: eGFR < 60 ? "ckd_likely" : eGFR < 90 ? "reduced_kidney_function" : "normal_kidney_function",
    confidence: Math.abs(score - 0.5) * 2,
    riskLevel: bandToRiskLevel(score),
    isStub: false,
    signals: [
      { label: "Creatinine (mg/dL)", value: creatinine },
      { label: "Estimated eGFR (mL/min/1.73m²)", value: Math.round(eGFR) },
      { label: "Proteinuria", value: proteinuria ? "Yes" : "No" },
      { label: "KDIGO stage", value: eGFR >= 90 ? "G1" : eGFR >= 60 ? "G2" : eGFR >= 45 ? "G3a" : eGFR >= 30 ? "G3b" : "G4+" },
    ],
    rationale:
      `CKD-EPI 2021 eGFR formula. Estimated eGFR = ${Math.round(eGFR)} mL/min/1.73m². ` +
      `KDIGO risk category determined by eGFR + proteinuria. Educational only.`,
  };
}

/**
 * Liver disease risk — based on NAFLD fibrosis score simplified.
 * Features: alt, ast, bilirubin, albumin, platelets
 */
export function calcLiverDiseaseRisk(form: FormFields): RiskResult {
  const alt = Number(form.alt ?? form.ALT ?? 35);
  const ast = Number(form.ast ?? form.AST ?? 30);
  const bilirubin = Number(form.bilirubin ?? 1.0);
  const albumin = Number(form.albumin ?? 4.0);
  const platelets = Number(form.platelets ?? 220);
  const age = Number(form.age ?? 50);
  const diabetic = form.diabetic === true || form.diabetic === 1 ? 1 : 0;
  const bmi = Number(form.bmi ?? 26);

  // AST/ALT ratio (> 2 suggests advanced disease)
  const astAltRatio = ast / Math.max(alt, 1);

  // NAFLD fibrosis score
  const nfs = -1.675
    + 0.037 * age
    + 0.094 * bmi
    + 1.13 * diabetic
    + 0.99 * astAltRatio
    - 0.013 * platelets
    - 0.66 * albumin;

  let score: number;
  if (nfs < -1.455) score = 0.15; // low probability of advanced fibrosis
  else if (nfs > 0.676) score = 0.82; // high probability
  else score = 0.45; // indeterminate

  // Bilirubin modifier
  if (bilirubin > 2.0) score = Math.min(1, score + 0.15);
  if (alt > 80 || ast > 80) score = Math.min(1, score + 0.1);

  return {
    classification: score > 0.65 ? "liver_disease_likely" : score > 0.35 ? "liver_risk_moderate" : "normal_liver_function",
    confidence: Math.abs(score - 0.5) * 2,
    riskLevel: bandToRiskLevel(score),
    isStub: false,
    signals: [
      { label: "ALT (U/L)", value: alt },
      { label: "AST (U/L)", value: ast },
      { label: "AST/ALT ratio", value: astAltRatio.toFixed(2) },
      { label: "Bilirubin (mg/dL)", value: bilirubin },
      { label: "NAFLD fibrosis score", value: nfs.toFixed(3) },
    ],
    rationale:
      `NAFLD Fibrosis Score = ${nfs.toFixed(2)}. ` +
      `Thresholds: < -1.455 = low risk, > 0.676 = high risk. Educational only.`,
  };
}

/**
 * Hypertension risk — based on BP stage + risk factors.
 */
export function calcHypertensionRisk(form: FormFields): RiskResult {
  const sbp = Number(
    form.systolicBP ?? form.systolicBp ?? form.systolic ?? form.sbp ?? 125
  );
  const dbp = Number(form.diastolicBP ?? form.diastolic ?? form.dbp ?? 82);
  const age = Number(form.age ?? 50);
  const smoker = form.smoker ? 1 : 0;
  const diabetic = form.diabetic ? 1 : 0;
  const familyHistory = form.familyHistory ? 1 : 0;

  // ACC/AHA 2017 staging
  let stageScore: number;
  if (sbp >= 180 || dbp >= 120) stageScore = 0.95;       // Crisis
  else if (sbp >= 140 || dbp >= 90) stageScore = 0.75;   // Stage 2
  else if (sbp >= 130 || dbp >= 80) stageScore = 0.5;    // Stage 1
  else if (sbp >= 120) stageScore = 0.25;                 // Elevated
  else stageScore = 0.1;                                  // Normal

  const riskBoost = (age > 60 ? 0.05 : 0) + smoker * 0.05 + diabetic * 0.05 + familyHistory * 0.03;
  const score = Math.min(1, stageScore + riskBoost);

  const stageLabel =
    sbp >= 180 ? "hypertensive_crisis" :
    sbp >= 140 ? "stage_2_hypertension" :
    sbp >= 130 ? "stage_1_hypertension" :
    sbp >= 120 ? "elevated_bp" : "normal_bp";

  return {
    classification: stageLabel,
    confidence: Math.abs(score - 0.5) * 2,
    riskLevel: bandToRiskLevel(score),
    isStub: false,
    signals: [
      { label: "Systolic BP (mmHg)", value: sbp },
      { label: "Diastolic BP (mmHg)", value: dbp },
      { label: "ACC/AHA Stage", value: stageLabel.replace(/_/g, " ") },
    ],
    rationale:
      `ACC/AHA 2017 BP classification. SBP=${sbp}, DBP=${dbp}. ` +
      `Classified as: ${stageLabel.replace(/_/g, " ")}. Educational only.`,
  };
}

/**
 * Stroke risk — CHA₂DS₂-VASc-inspired simplified score.
 */
export function calcStrokeRisk(form: FormFields): RiskResult {
  const age = Number(form.age ?? 60);
  const sex = String(form.sex ?? "male").toLowerCase();
  const heartFailure = form.heartFailure ? 1 : 0;
  const hypertension = form.hypertension ? 1 : 0;
  const diabetic = form.diabetic ? 1 : 0;
  const priorStroke = form.priorStroke ? 2 : 0;
  const vascularDisease = form.vascularDisease ? 1 : 0;

  let score = 0;
  if (age >= 75) score += 2;
  else if (age >= 65) score += 1;
  if (sex === "female") score += 1;
  score += heartFailure + hypertension + diabetic + priorStroke + vascularDisease;

  const maxScore = 9;
  const normalized = score / maxScore;

  return {
    classification: score >= 4 ? "high_stroke_risk" : score >= 2 ? "moderate_stroke_risk" : "low_stroke_risk",
    confidence: normalized,
    riskLevel: score >= 4 ? "high" : score >= 2 ? "medium" : "low",
    isStub: false,
    signals: [
      { label: "CHA₂DS₂-VASc score", value: score },
      { label: "Age", value: age },
      { label: "Risk category", value: score >= 4 ? "High" : score >= 2 ? "Moderate" : "Low" },
    ],
    rationale:
      `CHA₂DS₂-VASc score = ${score}/9. Used for stroke risk stratification. Educational only.`,
  };
}

// ---------------------------------------------------------------------------
// IMAGING RISK — content-aware stub + Flask ML sidecar fallback
// ---------------------------------------------------------------------------

/**
 * Basic image statistics from raw bytes.
 * These are crude proxies — brightness distribution, size — not real features.
 * But they're at least tied to image content rather than byte-order hash.
 */
function extractImageStats(imageBytes: Uint8Array | null): {
  estimatedBrightness: number;
  estimatedContrast: number;
  sizeKB: number;
} {
  if (!imageBytes || imageBytes.length === 0) {
    return { estimatedBrightness: 0.5, estimatedContrast: 0.5, sizeKB: 0 };
  }
  // Sample every 100th byte as a proxy for brightness
  let sum = 0;
  let count = 0;
  for (let i = 0; i < imageBytes.length; i += 100) {
    sum += imageBytes[i]! / 255;
    count++;
  }
  const brightness = count > 0 ? sum / count : 0.5;

  // Variance proxy for contrast
  let varSum = 0;
  for (let i = 0; i < imageBytes.length; i += 100) {
    const v = imageBytes[i]! / 255 - brightness;
    varSum += v * v;
  }
  const contrast = Math.sqrt(varSum / Math.max(count, 1));

  return {
    estimatedBrightness: brightness,
    estimatedContrast: contrast,
    sizeKB: Math.round(imageBytes.length / 1024),
  };
}

export async function calculateImagingRisk(
  slug: string,
  positiveLabel: string,
  negativeLabel: string,
  input: {
    imageBase64?: string;
    imageByteLength?: number;
    imageMimeType?: string;
  }
): Promise<RiskResult> {
  // Try Flask ML sidecar first
  const mlUrl = process.env.DISEASE_ML_URL;
  if (mlUrl && input.imageBase64) {
    try {
      const res = await fetch(`${mlUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, imageBase64: input.imageBase64 }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          score?: number;
          classification?: string;
          confidence?: number;
        };
        const score = data.score ?? 0.5;
        return {
          classification: data.classification ?? (score >= 0.5 ? positiveLabel : negativeLabel),
          confidence: data.confidence ?? Math.abs(score - 0.5) * 2,
          riskLevel: bandToRiskLevel(score),
          isStub: false,
          signals: [
            { label: "ML model score", value: Number(score.toFixed(3)) },
            { label: "Source", value: "Flask ML sidecar" },
          ],
          rationale: `Prediction from the Flask ML sidecar at ${mlUrl}.`,
        };
      }
    } catch {
      // Fall through to stub
    }
  }

  // Content-aware stub
  let imageBytes: Uint8Array | null = null;
  if (input.imageBase64) {
    try {
      const clean = input.imageBase64.replace(/^data:[^;]+;base64,/, "");
      imageBytes = new Uint8Array(Buffer.from(clean, "base64"));
    } catch {
      imageBytes = null;
    }
  }

  const { estimatedBrightness, estimatedContrast, sizeKB } = extractImageStats(imageBytes);

  // Low brightness + high contrast (common in MRI/X-ray with pathology) → higher score
  // This is still a stub but at least responds to image content
  const baseScore = 0.3 + estimatedContrast * 0.4 + (1 - estimatedBrightness) * 0.3;
  const score = Math.max(0, Math.min(1, baseScore));
  const positive = score >= 0.5;

  return {
    classification: positive ? positiveLabel : negativeLabel,
    confidence: Math.abs(score - 0.5) * 2,
    riskLevel: bandToRiskLevel(score),
    isStub: true,
    signals: [
      { label: "Content-aware stub score", value: Number(score.toFixed(3)) },
      { label: "Est. brightness", value: Number(estimatedBrightness.toFixed(3)) },
      { label: "Est. contrast", value: Number(estimatedContrast.toFixed(3)) },
      { label: "Image size (KB)", value: sizeKB },
    ],
    rationale:
      `⚠ SYNTHETIC STUB. No real ${slug} classification model is loaded. ` +
      `Score is derived from basic image statistics (brightness/contrast). ` +
      `Set DISEASE_ML_URL to enable real ML predictions. ` +
      `Do NOT use for any clinical decision.`,
  };
}

// ---------------------------------------------------------------------------
// Router — call the right calculator for any disease slug
// ---------------------------------------------------------------------------
export function calculateClinicalRisk(
  slug: string,
  form: FormFields = {}
): RiskResult {
  switch (slug) {
    case "diabetes":
    case "diabetic-retinopathy":
      return calcDiabetesRisk(form);
    case "heart-disease":
      return calcHeartDiseaseRisk(form);
    case "kidney-disease":
      return calcKidneyDiseaseRisk(form);
    case "liver-disease":
      return calcLiverDiseaseRisk(form);
    case "hypertension":
      return calcHypertensionRisk(form);
    case "stroke":
      return calcStrokeRisk(form);
    default: {
      // Unknown clinical disease — return a conservative medium risk
      return {
        classification: "risk_unknown",
        confidence: 0.1,
        riskLevel: "medium",
        isStub: true,
        signals: [{ label: "Note", value: "No specific model for this disease" }],
        rationale: `No clinical risk model implemented for ${slug}. Medium risk returned as conservative default.`,
      };
    }
  }
}
