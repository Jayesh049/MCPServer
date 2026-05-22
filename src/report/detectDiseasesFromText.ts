import { listDiseases } from "../diseases/registry.js";
import { getTbWeightedKeywords } from "./tbLexicon.js";

export type ReportRiskLevel = "low" | "medium" | "high";

export type DiseaseHit = {
  slug: string;
  name: string;
  score: number; // 0..1
  riskLevel: ReportRiskLevel;
  evidence: string[];
  evidenceSnippets: string[];
};

type WeightedTerm = { term: string; weight: number };

/** Keyword weights — specific terms score higher; vague terms score lower. */
const WEIGHTED_KEYWORDS: Record<string, WeightedTerm[]> = {
  "brain-tumor": [
    { term: "intracranial mass", weight: 0.4 },
    { term: "glioma", weight: 0.5 },
    { term: "meningioma", weight: 0.5 },
    { term: "brain tumor", weight: 0.5 },
    { term: "pituitary tumor", weight: 0.4 },
    { term: "pituitary adenoma", weight: 0.4 }
  ],
  pneumonia: [
    { term: "pneumonia", weight: 0.5 },
    { term: "lobar consolidation", weight: 0.4 },
    { term: "pulmonary infiltrate", weight: 0.35 },
    { term: "consolidation", weight: 0.25 },
    { term: "infiltrate", weight: 0.2 },
    { term: "opacity", weight: 0.15 }
  ],
  // tuberculosis: loaded from TB.pdf-trained lexicon (see npm run train:tb)
  "covid-19": [
    { term: "covid-19", weight: 0.5 },
    { term: "sars-cov-2", weight: 0.5 },
    { term: "covid", weight: 0.35 },
    { term: "ground glass opacity", weight: 0.35 },
    { term: "ground glass", weight: 0.25 },
    { term: "ggo", weight: 0.2 }
  ],
  "skin-cancer": [
    { term: "melanoma", weight: 0.5 },
    { term: "skin cancer", weight: 0.5 },
    { term: "basal cell carcinoma", weight: 0.45 },
    { term: "squamous cell carcinoma", weight: 0.45 },
    { term: "basal cell", weight: 0.3 }
  ],
  "diabetic-retinopathy": [
    { term: "diabetic retinopathy", weight: 0.5 },
    { term: "proliferative retinopathy", weight: 0.45 },
    { term: "npdr", weight: 0.35 },
    { term: "pdr", weight: 0.35 }
  ],
  glaucoma: [
    { term: "glaucoma", weight: 0.5 },
    { term: "intraocular pressure", weight: 0.35 },
    { term: "cup-to-disc", weight: 0.35 },
    { term: "iop", weight: 0.2 }
  ],
  cataract: [
    { term: "cataract", weight: 0.5 },
    { term: "lens opacity", weight: 0.4 },
    { term: "phacoemulsification", weight: 0.35 }
  ],
  "breast-cancer": [
    { term: "breast cancer", weight: 0.5 },
    { term: "mammogram", weight: 0.35 },
    { term: "birads", weight: 0.4 },
    { term: "malignancy", weight: 0.3 }
  ],
  "lung-cancer": [
    { term: "lung cancer", weight: 0.5 },
    { term: "pulmonary nodule", weight: 0.4 },
    { term: "nsclc", weight: 0.45 },
    { term: "small cell lung", weight: 0.45 },
    { term: "nodule", weight: 0.15 }
  ],
  "bone-fracture": [
    { term: "fracture", weight: 0.45 },
    { term: "displaced fracture", weight: 0.4 },
    { term: "non-displaced", weight: 0.25 }
  ],
  alzheimers: [
    { term: "alzheimer", weight: 0.5 },
    { term: "dementia", weight: 0.35 },
    { term: "memory clinic", weight: 0.3 },
    { term: "mci", weight: 0.25 }
  ],
  diabetes: [
    { term: "diabetes mellitus", weight: 0.5 },
    { term: "type 2 diabetes", weight: 0.5 },
    { term: "hba1c", weight: 0.4 },
    { term: "hb a1c", weight: 0.4 },
    { term: "a1c", weight: 0.3 },
    { term: "fasting glucose", weight: 0.35 },
    { term: "hyperglycemia", weight: 0.3 },
    { term: "diabetes", weight: 0.35 }
  ],
  "heart-disease": [
    { term: "coronary artery disease", weight: 0.5 },
    { term: "myocardial infarction", weight: 0.5 },
    { term: "angina pectoris", weight: 0.4 },
    { term: "ascvd", weight: 0.3 },
    { term: "ischemia", weight: 0.3 },
    { term: "coronary", weight: 0.25 },
    { term: "cad", weight: 0.25 }
  ],
  "kidney-disease": [
    { term: "chronic kidney disease", weight: 0.5 },
    { term: "ckd stage", weight: 0.45 },
    { term: "egfr", weight: 0.35 },
    { term: "proteinuria", weight: 0.35 },
    { term: "creatinine elevated", weight: 0.3 },
    { term: "chronic kidney", weight: 0.4 },
    { term: "uacr", weight: 0.25 }
  ],
  "liver-disease": [
    { term: "liver cirrhosis", weight: 0.5 },
    { term: "hepatitis", weight: 0.45 },
    { term: "fatty liver", weight: 0.4 },
    { term: "portal hypertension", weight: 0.45 },
    { term: "cirrhosis", weight: 0.45 },
    { term: "elevated alt", weight: 0.3 },
    { term: "elevated ast", weight: 0.3 },
    { term: "bilirubin", weight: 0.2 }
  ],
  hypertension: [
    { term: "hypertension", weight: 0.5 },
    { term: "stage 2 hypertension", weight: 0.5 },
    { term: "stage 1 hypertension", weight: 0.45 },
    { term: "blood pressure elevated", weight: 0.35 },
    { term: "systolic blood pressure", weight: 0.2 }
  ],
  stroke: [
    { term: "ischemic stroke", weight: 0.5 },
    { term: "cerebrovascular accident", weight: 0.5 },
    { term: "intracranial hemorrhage", weight: 0.45 },
    { term: "thrombolysis", weight: 0.4 },
    { term: "stroke", weight: 0.4 },
    { term: "cva", weight: 0.35 },
    { term: "tia", weight: 0.35 }
  ],
  parkinsons: [
    { term: "parkinson", weight: 0.5 },
    { term: "bradykinesia", weight: 0.4 },
    { term: "levodopa", weight: 0.35 },
    { term: "rigidity", weight: 0.25 }
  ],
  "sleep-apnea": [
    { term: "sleep apnea", weight: 0.5 },
    { term: "obstructive sleep apnea", weight: 0.5 },
    { term: "stop-bang", weight: 0.4 },
    { term: "cpap", weight: 0.35 },
    { term: "ahi", weight: 0.3 }
  ]
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreToRiskLevel(score: number): ReportRiskLevel {
  if (score >= 0.65) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}

function makeSnippet(text: string, needle: string, radius: number): string | null {
  const t = normalize(text);
  const n = normalize(needle);
  const idx = t.indexOf(n);
  if (idx < 0) return null;
  const start = Math.max(0, idx - radius);
  const end = Math.min(t.length, idx + n.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < t.length ? "…" : "";
  return `${prefix}${t.slice(start, end)}${suffix}`;
}

export function detectDiseasesFromText(text: string): DiseaseHit[] {
  const t = normalize(text);
  const diseases = listDiseases();
  const nameBySlug = new Map(diseases.map((d) => [d.slug, d.name]));

  const hits: DiseaseHit[] = [];

  for (const d of diseases) {
    const kwList =
      d.slug === "tuberculosis"
        ? getTbWeightedKeywords()
        : WEIGHTED_KEYWORDS[d.slug];
    if (!kwList?.length) continue;

    let totalWeight = 0;
    const evidence: string[] = [];
    const evidenceSnippets: string[] = [];

    for (const { term, weight } of kwList) {
      const nk = normalize(term);
      if (t.includes(nk)) {
        totalWeight += weight;
        evidence.push(term);
        const snip = makeSnippet(text, term, 60);
        if (snip && !evidenceSnippets.includes(snip)) {
          evidenceSnippets.push(snip);
        }
      }
    }

    const highWeightHit = kwList.some(
      ({ term, weight }) => weight >= 0.4 && t.includes(normalize(term))
    );
    if (evidence.length < 2 && !highWeightHit) continue;

    const score = Math.min(1, 0.2 + totalWeight);
    hits.push({
      slug: d.slug,
      name: nameBySlug.get(d.slug) ?? d.slug,
      score,
      riskLevel: scoreToRiskLevel(score),
      evidence,
      evidenceSnippets
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, 5);
}
