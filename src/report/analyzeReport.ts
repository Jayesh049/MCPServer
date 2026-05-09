import { buildCarePlan } from "../care/carePlan.js";
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

