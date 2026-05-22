import type { ReportAnalysisResult } from "./types";

/** Demo payload matching agents_assemble_stunning_ui.html */
export function demoReportResult(): ReportAnalysisResult {
  return {
    extracted: {
      charCount: 49967,
      pages: 26,
      textPreview:
        "PERSONAL HEALTH SMART REPORT\nPrepared for Jayesh Kumar Singh\nBasic Info — Male / 25 Yrs\nSample collection date 06/01/2026\nNational Reference Lab, Delhi\n"
    },
    detectedDiseases: [
      {
        slug: "liver-disease",
        name: "Liver disease (clinical)",
        score: 1.0,
        evidence: ["alt", "ast", "bilirubin", "cirrhosis", "hepatitis", "fatty liver"],
        evidenceSnippets: []
      },
      {
        slug: "diabetes",
        name: "Diabetes risk (clinical)",
        score: 0.8,
        evidence: ["diabetes", "hbA1c", "a1c"],
        evidenceSnippets: []
      },
      {
        slug: "tuberculosis",
        name: "Tuberculosis (chest X-ray)",
        score: 0.65,
        evidence: ["tuberculosis", "tb"],
        evidenceSnippets: []
      },
      {
        slug: "heart-disease",
        name: "Heart disease risk",
        score: 0.65,
        evidence: ["cad", "ascvd"],
        evidenceSnippets: []
      },
      {
        slug: "kidney-disease",
        name: "Chronic kidney disease",
        score: 0.65,
        evidence: ["creatinine", "proteinuria"],
        evidenceSnippets: []
      }
    ],
    primaryDisease: {
      slug: "liver-disease",
      name: "Liver disease (clinical)",
      score: 1.0,
      evidence: [],
      evidenceSnippets: []
    },
    carePlan: null,
    notes: ["Demo data — start backend for live PDF analysis."]
  };
}
