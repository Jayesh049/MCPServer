import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TbLexiconModel, WeightedTerm } from "../training/tuberculosisLexiconBuilder.js";
import { buildTbLexiconFromPdfText } from "../training/tuberculosisLexiconBuilder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cached: TbLexiconModel | null | undefined;

const FALLBACK_TERMS: WeightedTerm[] = [
  { term: "tuberculosis", weight: 0.5, source: "fallback" },
  { term: "mycobacterium tuberculosis", weight: 0.55, source: "fallback" },
  { term: "acid-fast bacilli", weight: 0.5, source: "fallback" },
  { term: "xpert mtb/rif", weight: 0.5, source: "fallback" },
  { term: "sputum smear", weight: 0.45, source: "fallback" },
  { term: "chest x-ray", weight: 0.45, source: "fallback" },
  { term: "latent tb", weight: 0.4, source: "fallback" },
  { term: "mdr-tb", weight: 0.48, source: "fallback" },
  { term: "cavitation", weight: 0.3, source: "fallback" },
  { term: "tb", weight: 0.1, source: "fallback" }
];

function lexiconPaths(): string[] {
  return [
    path.join(__dirname, "..", "diseases", "models", "tb-lexicon.json"),
    path.join(process.cwd(), "src", "diseases", "models", "tb-lexicon.json"),
    path.join(process.cwd(), "data", "tuberculosis", "tb-lexicon.json")
  ];
}

export function loadTbLexicon(): TbLexiconModel | null {
  if (cached !== undefined) return cached;
  for (const p of lexiconPaths()) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, "utf8");
      cached = JSON.parse(raw) as TbLexiconModel;
      return cached;
    } catch {
      continue;
    }
  }
  cached = null;
  return null;
}

export function getTbWeightedKeywords(): WeightedTerm[] {
  const model = loadTbLexicon();
  if (model?.weightedTerms?.length) return model.weightedTerms;
  return FALLBACK_TERMS;
}

export function getTbLexiconMeta(): {
  trained: boolean;
  trainedAt?: string;
  sourceCitation?: string;
  termCount: number;
  logicSummary: string[];
  diagnosticPillars: TbLexiconModel["diagnosticPillars"];
} {
  const model = loadTbLexicon();
  if (!model) {
    return {
      trained: false,
      termCount: FALLBACK_TERMS.length,
      logicSummary: ["Using built-in fallback TB keywords. Run npm run train:tb with TB.pdf."],
      diagnosticPillars: []
    };
  }
  return {
    trained: true,
    trainedAt: model.trainedAt,
    sourceCitation: model.sourceCitation,
    termCount: model.weightedTerms.length,
    logicSummary: model.logicSummary,
    diagnosticPillars: model.diagnosticPillars
  };
}

/** Score report/lab text for TB likelihood (0..1). */
export function scoreTbText(text: string): {
  score: number;
  evidence: string[];
  riskLevel: "low" | "medium" | "high";
} {
  const t = text.toLowerCase().replace(/\s+/g, " ");
  const terms = getTbWeightedKeywords();
  let total = 0;
  const evidence: string[] = [];

  for (const { term, weight } of terms) {
    const nk = term.toLowerCase();
    if (t.includes(nk)) {
      total += weight;
      evidence.push(term);
    }
  }

  const highHit = terms.some(({ term, weight }) => weight >= 0.4 && t.includes(term.toLowerCase()));
  if (evidence.length < 2 && !highHit) {
    return { score: 0, evidence: [], riskLevel: "low" };
  }

  const score = Math.min(1, 0.2 + total);
  const riskLevel = score >= 0.65 ? "high" : score >= 0.35 ? "medium" : "low";
  return { score, evidence, riskLevel };
}

export { buildTbLexiconFromPdfText };
