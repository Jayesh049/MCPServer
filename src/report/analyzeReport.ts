import { buildCarePlan } from "../care/carePlan.js";
import { isTbSklearnModelAvailable, predictTbSklearnText } from "../diseases/predictors/tuberculosisSklearn.js";
import { detectDiseasesFromText, type DiseaseHit } from "./detectDiseasesFromText.js";

export type ReportAnalysis = {
  extracted: {
    pages?: number;
    textPreview: string;
    charCount: number;
  };
  detectedDiseases: DiseaseHit[];
  primaryDisease: DiseaseHit | null;
  carePlan: ReturnType<typeof buildCarePlan> | null;
  notes: string[];
};

function preview(text: string, maxChars: number): string {
  const t = text.trim();
  return t.length > maxChars ? t.slice(0, maxChars) + "…" : t;
}

function looksLikeMedicalReport(text: string): boolean {
  const t = text.toLowerCase();
  const signals = [
    // Common report section headers / clinical terms
    "impression",
    "findings",
    "assessment",
    "diagnosis",
    "history",
    "chief complaint",
    "medications",
    "allergies",
    "vitals",
    "blood pressure",
    "heart rate",
    "respiratory rate",
    "temperature",
    "spo2",
    "laboratory",
    "labs",
    "wbc",
    "hemoglobin",
    "platelet",
    "creatinine",
    "egfr",
    "bilirubin",
    "ast",
    "alt",
    "glucose",
    "hba1c",
    "mg/dl",
    "mmhg",
    "ct",
    "mri",
    "x-ray",
    "ultrasound"
  ];
  let hits = 0;
  for (const s of signals) if (t.includes(s)) hits++;
  // Require multiple signals so resumes don't pass by accident.
  return hits >= 3;
}

function scoreToRiskLevel(score: number): DiseaseHit["riskLevel"] {
  if (score >= 0.65) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}

/** Merge TB2-trained sklearn probability into disease hits when model is present. */
export async function enhanceTbMlDetection(
  text: string,
  hits: DiseaseHit[]
): Promise<{ hits: DiseaseHit[]; mlNote?: string }> {
  if (!isTbSklearnModelAvailable()) {
    return { hits };
  }
  const ml = await predictTbSklearnText(text);
  if (!ml.ok || ml.tbProbability === undefined) {
    return { hits, mlNote: ml.error };
  }

  const p = ml.tbProbability;
  const mlScore = Math.min(1, 0.15 + p * 0.85);
  const idx = hits.findIndex((h) => h.slug === "tuberculosis");
  const evidence = [
    `sklearn_tb2_ml:p=${p.toFixed(3)}`,
    ...(ml.meta?.metrics?.formulaKey ? [`model:${ml.meta.metrics.formulaKey}`] : []),
    ...(ml.meta?.metrics?.cvAuc !== undefined
      ? [`cv_auc:${ml.meta.metrics.cvAuc.toFixed(3)}`]
      : [])
  ];

  let next: DiseaseHit[];
  if (idx >= 0) {
    const prev = hits[idx]!;
    const mergedScore = Math.min(1, Math.max(prev.score, mlScore));
    next = [...hits];
    next[idx] = {
      ...prev,
      score: mergedScore,
      riskLevel: scoreToRiskLevel(mergedScore),
      evidence: [...prev.evidence, ...evidence]
    };
  } else if (p >= 0.45) {
    next = [
      ...hits,
      {
        slug: "tuberculosis",
        name: "Tuberculosis (chest X-ray)",
        score: mlScore,
        riskLevel: scoreToRiskLevel(mlScore),
        evidence,
        evidenceSnippets: []
      }
    ];
  } else {
    return {
      hits,
      mlNote: `sklearn TB probability ${p.toFixed(3)} below report threshold`
    };
  }

  next.sort((a, b) => b.score - a.score);
  return {
    hits: next.slice(0, 5),
    mlNote: `TB2 sklearn merged (P(TB)=${p.toFixed(3)}, CV AUC≈${ml.meta?.metrics?.cvAuc?.toFixed(3) ?? "n/a"})`
  };
}

export async function analyzeReportTextAsync(text: string, pages?: number): Promise<ReportAnalysis> {
  const base = analyzeReportText(text, pages);
  const { hits, mlNote } = await enhanceTbMlDetection(text, base.detectedDiseases);
  const primary = hits[0] ?? null;
  const carePlan = primary ? buildCarePlan(primary.slug) : null;
  return {
    ...base,
    detectedDiseases: hits,
    primaryDisease: primary,
    carePlan,
    notes: [
      ...base.notes,
      ...(mlNote ? [mlNote] : []),
      ...(isTbSklearnModelAvailable()
        ? ["TB detection uses real sklearn ML trained from TB2.pdf (TF-IDF + LR/RF)."]
        : ["Run npm run train:tb2-ml to enable TB2 sklearn model."])
    ]
  };
}

export function analyzeReportText(text: string, pages?: number): ReportAnalysis {
  const strictGate = (process.env.REPORT_STRICT_GATE ?? "0") === "1";
  const medicalish = looksLikeMedicalReport(text);
  const tooShort = text.trim().length < 80;

  if (strictGate && !medicalish) {
    return {
      extracted: {
        pages,
        textPreview: preview(text, 600),
        charCount: text.length
      },
      detectedDiseases: [],
      primaryDisease: null,
      carePlan: null,
      notes: [
        "Blocked: this document does not look like a medical report (e.g., resume/letter).",
        "Set REPORT_STRICT_GATE=0 to disable blocking."
      ]
    };
  }

  const hits = detectDiseasesFromText(text);
  const primary = hits[0] ?? null;
  const carePlan = primary ? buildCarePlan(primary.slug) : null;

  return {
    extracted: {
      pages,
      textPreview: preview(text, 1200),
      charCount: text.length
    },
    detectedDiseases: hits,
    primaryDisease: primary,
    carePlan,
    notes: [
      ...(tooShort
        ? [
            "No/very little text was extracted. This usually means the PDF is scanned (image-only). Add OCR or upload a searchable PDF."
          ]
        : []),
      ...(medicalish
        ? []
        : [
            "Warning: this document may not be a medical report. Detection is keyword-based and can produce false positives."
          ]),
      "This parser runs locally and uses simple keyword matching for disease detection.",
      "For hackathon safety: do not upload PHI. Use synthetic/de-identified reports only."
    ]
  };
}

