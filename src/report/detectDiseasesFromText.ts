import { listDiseases } from "../diseases/registry.js";

export type DiseaseHit = {
  slug: string;
  name: string;
  score: number; // 0..1
  evidence: string[];
  evidenceSnippets: string[];
};

const KEYWORDS: Record<string, string[]> = {
  "brain-tumor": ["brain tumor", "intracranial mass", "glioma", "meningioma", "pituitary tumor"],
  pneumonia: ["pneumonia", "consolidation", "opacity", "infiltrate"],
  tuberculosis: ["tuberculosis", "tb", "acid-fast", "afb", "mtb/rif", "cavitation"],
  "covid-19": ["covid", "sars-cov-2", "ground glass", "ggo"],
  "skin-cancer": ["melanoma", "skin cancer", "basal cell", "squamous cell carcinoma"],
  "diabetic-retinopathy": ["diabetic retinopathy", "npdr", "pdr", "proliferative retinopathy"],
  glaucoma: ["glaucoma", "iop", "intraocular pressure", "cup-to-disc", "c:d"],
  cataract: ["cataract", "lens opacity", "phacoemulsification", "iOL"],
  "breast-cancer": ["breast cancer", "mammogram", "birads", "bIRADS", "mass", "malignancy"],
  "lung-cancer": ["lung cancer", "pulmonary nodule", "nodule", "nsclc", "small cell", "metastatic"],
  "bone-fracture": ["fracture", "fx", "break", "displaced", "non-displaced"],
  alzheimers: ["alzheimer", "dementia", "memory clinic", "atrophy", "mci"],
  diabetes: ["diabetes", "hbA1c", "a1c", "fasting glucose", "hyperglycemia"],
  "heart-disease": ["coronary", "cad", "ischemia", "ascvd", "angina", "myocardial infarction"],
  "kidney-disease": ["ckd", "chronic kidney", "egfr", "creatinine", "proteinuria", "uacr"],
  "liver-disease": ["alt", "ast", "bilirubin", "cirrhosis", "hepatitis", "fatty liver"],
  stroke: ["stroke", "tia", "cva", "thrombolysis", "intracranial hemorrhage"],
  hypertension: ["hypertension", "blood pressure", "sbp", "dbp", "stage 1", "stage 2"],
  parkinsons: ["parkinson", "bradykinesia", "tremor", "rigidity", "levodopa"],
  "sleep-apnea": ["sleep apnea", "osa", "stop-bang", "cpap", "ahi", "snoring"]
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
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

  const hits: DiseaseHit[] = [];
  for (const d of diseases) {
    const kw = KEYWORDS[d.slug] ?? [];
    if (kw.length === 0) continue;
    const evidence: string[] = [];
    const evidenceSnippets: string[] = [];
    let count = 0;
    for (const k of kw) {
      const nk = normalize(k);
      if (t.includes(nk)) {
        count++;
        evidence.push(k);
        const snip = makeSnippet(text, k, 60);
        if (snip) evidenceSnippets.push(snip);
      }
    }
    if (count > 0) {
      // Simple scoring: saturating function on keyword hits.
      const score = Math.min(1, 0.35 + count * 0.15);
      hits.push({ slug: d.slug, name: d.name, score, evidence, evidenceSnippets });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, 5);
}

