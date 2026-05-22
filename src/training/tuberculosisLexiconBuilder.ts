/**
 * Builds a weighted TB keyword lexicon from the review PDF (TB.pdf).
 * Source paper: Memon et al., "Integration of AI and ML in Tuberculosis (TB) Management"
 * Diseases 2025, 13, 184 — used for education / report keyword detection only.
 */

export type WeightedTerm = { term: string; weight: number; source: string };

export type TbLexiconModel = {
  diseaseSlug: "tuberculosis";
  trainedAt: string;
  sourcePdf: string;
  sourceCitation: string;
  logicSummary: string[];
  weightedTerms: WeightedTerm[];
  diagnosticPillars: {
    id: string;
    label: string;
    terms: string[];
  }[];
  metrics?: {
    pdfCharCount: number;
    termCount: number;
  };
};

/** Curated from TB.pdf sections: diagnosis, symptoms, AI/ML methods, resistance, prevention. */
const CURATED_FROM_PDF: WeightedTerm[] = [
  // Pathogen & disease (Introduction §1.1)
  { term: "mycobacterium tuberculosis", weight: 0.55, source: "pdf:pathogen" },
  { term: "m. tuberculosis", weight: 0.5, source: "pdf:pathogen" },
  { term: "mtb bacteria", weight: 0.45, source: "pdf:pathogen" },
  { term: "tuberculosis", weight: 0.5, source: "pdf:core" },
  { term: "active tb", weight: 0.45, source: "pdf:latent_vs_active" },
  { term: "latent tb", weight: 0.4, source: "pdf:latent_vs_active" },
  { term: "white death", weight: 0.35, source: "pdf:history" },
  // Classic diagnostics (Abstract + §1.1)
  { term: "sputum smear microscopy", weight: 0.5, source: "pdf:traditional_dx" },
  { term: "sputum smear", weight: 0.45, source: "pdf:traditional_dx" },
  { term: "culture test", weight: 0.4, source: "pdf:traditional_dx" },
  { term: "culture tests", weight: 0.4, source: "pdf:traditional_dx" },
  { term: "chest x-ray", weight: 0.45, source: "pdf:traditional_dx" },
  { term: "chest x-rays", weight: 0.45, source: "pdf:traditional_dx" },
  { term: "chest x ray", weight: 0.4, source: "pdf:traditional_dx" },
  { term: "cxr", weight: 0.35, source: "pdf:imaging" },
  { term: "tuberculin skin test", weight: 0.45, source: "pdf:latent_dx" },
  { term: "tst", weight: 0.2, source: "pdf:latent_dx" },
  { term: "blood tests", weight: 0.25, source: "pdf:latent_dx" },
  { term: "microscopic analysis", weight: 0.35, source: "pdf:traditional_dx" },
  // Molecular / lab (throughout review)
  { term: "acid-fast bacilli", weight: 0.5, source: "pdf:lab" },
  { term: "acid-fast", weight: 0.35, source: "pdf:lab" },
  { term: "afb positive", weight: 0.5, source: "pdf:lab" },
  { term: "xpert mtb/rif", weight: 0.5, source: "pdf:molecular" },
  { term: "xpert mtb", weight: 0.48, source: "pdf:molecular" },
  { term: "mtb/rif", weight: 0.5, source: "pdf:molecular" },
  { term: "genexpert", weight: 0.45, source: "pdf:molecular" },
  // Imaging findings (AI imaging sections)
  { term: "cavitation", weight: 0.35, source: "pdf:imaging_findings" },
  { term: "pulmonary infiltrate", weight: 0.3, source: "pdf:imaging_findings" },
  { term: "consolidation", weight: 0.28, source: "pdf:imaging_findings" },
  // Resistance & treatment (§1.1)
  { term: "multidrug-resistant tuberculosis", weight: 0.5, source: "pdf:mdr" },
  { term: "mdr-tb", weight: 0.48, source: "pdf:mdr" },
  { term: "drug-resistant", weight: 0.35, source: "pdf:mdr" },
  { term: "antibiotic resistance", weight: 0.3, source: "pdf:mdr" },
  { term: "isoniazid", weight: 0.35, source: "pdf:treatment" },
  { term: "rifampicin", weight: 0.35, source: "pdf:treatment" },
  // Symptoms (§1.1)
  { term: "night sweats", weight: 0.4, source: "pdf:symptoms" },
  { term: "chronic cough", weight: 0.4, source: "pdf:symptoms" },
  { term: "bloody mucus", weight: 0.38, source: "pdf:symptoms" },
  { term: "hemoptysis", weight: 0.4, source: "pdf:symptoms" },
  { term: "weight loss", weight: 0.22, source: "pdf:symptoms" },
  // Prevention (§1.1)
  { term: "bcg vaccination", weight: 0.35, source: "pdf:prevention" },
  { term: "bacillus calmette", weight: 0.35, source: "pdf:prevention" },
  // AI/ML methods cited for TB (§1.2 — boosts educational reports discussing AI-TB)
  { term: "convolutional neural network", weight: 0.25, source: "pdf:ai_methods" },
  { term: "convolutional neural networks", weight: 0.25, source: "pdf:ai_methods" },
  { term: "cnn", weight: 0.15, source: "pdf:ai_methods" },
  { term: "support vector machine", weight: 0.2, source: "pdf:ai_methods" },
  { term: "random forest", weight: 0.2, source: "pdf:ai_methods" },
  { term: "deep learning", weight: 0.18, source: "pdf:ai_methods" },
  { term: "artificial intelligence", weight: 0.12, source: "pdf:ai_methods" },
  { term: "machine learning", weight: 0.12, source: "pdf:ai_methods" },
  // Short token — low weight (avoid false positives)
  { term: "tb", weight: 0.1, source: "pdf:abbrev" }
];

const PDF_TERM_PATTERNS: { pattern: RegExp; weight: number; source: string }[] = [
  { pattern: /\btubercul\w{2,24}\b/gi, weight: 0.32, source: "pdf:freq:tubercul*" },
  { pattern: /\b(?:xpert|genexpert)\s*\w*/gi, weight: 0.38, source: "pdf:freq:molecular" },
  { pattern: /\b(?:sputum|smear)\s+\w{0,20}/gi, weight: 0.35, source: "pdf:freq:sputum" },
  { pattern: /\b(?:latent|active)\s+tb\b/gi, weight: 0.4, source: "pdf:freq:latent_active" },
  { pattern: /\bmdr[- ]?tb\b/gi, weight: 0.42, source: "pdf:freq:mdr" }
];

function normalizeTerm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Pull extra recurring phrases from extracted PDF text (deduped, min length). */
export function extractFrequencyTerms(pdfText: string, maxTerms = 12): WeightedTerm[] {
  const seen = new Set<string>();
  const out: WeightedTerm[] = [];

  for (const { pattern, weight, source } of PDF_TERM_PATTERNS) {
    const matches = pdfText.match(pattern) ?? [];
    const counts = new Map<string, number>();
    for (const m of matches) {
      const n = normalizeTerm(m);
      if (n.length < 4) continue;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    for (const [term, count] of counts) {
      if (seen.has(term) || count < 3) continue;
      seen.add(term);
      out.push({
        term,
        weight: Math.min(0.45, weight + count * 0.02),
        source
      });
      if (out.length >= maxTerms) return out;
    }
  }
  return out;
}

export function buildTbLexiconFromPdfText(
  pdfText: string,
  opts?: { sourcePdf?: string }
): TbLexiconModel {
  const freq = extractFrequencyTerms(pdfText);
  const byTerm = new Map<string, WeightedTerm>();

  for (const t of [...CURATED_FROM_PDF, ...freq]) {
    const key = normalizeTerm(t.term);
    const existing = byTerm.get(key);
    if (!existing || t.weight > existing.weight) {
      byTerm.set(key, { ...t, term: key });
    }
  }

  const weightedTerms = [...byTerm.values()].sort((a, b) => b.weight - a.weight);

  return {
    diseaseSlug: "tuberculosis",
    trainedAt: new Date().toISOString(),
    sourcePdf: opts?.sourcePdf ?? "TB.pdf",
    sourceCitation:
      "Memon S, Bibi S, He G. Integration of AI and ML in Tuberculosis (TB) Management. Diseases. 2025;13(6):184.",
    logicSummary: [
      "Layer 1 — Curated lexicon from PDF sections: pathogen, traditional diagnostics (smear, culture, CXR), latent/active TB, molecular tests (Xpert/AFB), MDR-TB, symptoms, BCG, and AI methods (CNN/SVM/RF) cited in the review.",
      "Layer 2 — Frequency mining on full PDF text for recurring diagnostic phrases (tubercul*, sputum/smear, latent/active TB, MDR-TB).",
      "Scoring (report analyzer): score = min(1, 0.2 + sum matched term weights); require ≥2 hits OR one term with weight ≥0.4; map score to low/medium/high risk.",
      "Imaging MCP path unchanged: chest X-ray still uses imagingRiskPredict unless DISEASE_ML_URL provides a trained image model."
    ],
    weightedTerms,
    diagnosticPillars: [
      {
        id: "traditional",
        label: "Traditional diagnostics (PDF §1.1)",
        terms: ["sputum smear microscopy", "culture tests", "chest x-ray", "microscopic analysis"]
      },
      {
        id: "molecular",
        label: "Molecular / lab",
        terms: ["acid-fast bacilli", "xpert mtb/rif", "afb positive", "genexpert"]
      },
      {
        id: "clinical",
        label: "Clinical presentation",
        terms: ["latent tb", "active tb", "night sweats", "chronic cough", "mdr-tb"]
      },
      {
        id: "ai",
        label: "AI/ML in TB (review focus)",
        terms: ["convolutional neural network", "deep learning", "support vector machine", "random forest"]
      }
    ],
    metrics: {
      pdfCharCount: pdfText.length,
      termCount: weightedTerms.length
    }
  };
}
