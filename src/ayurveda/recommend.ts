import type { Prisma } from "@prisma/client";
import { QuestionKind } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getDiseaseBySlug } from "../diseases/registry.js";
import { embedText, getActiveEmbedProvider } from "../rag/embed.js";
import { cosineSimilarity } from "../rag/similarity.js";
import { synthesizeFreeLlm } from "../llm/freeLlm.js";

const TOP_K = Math.min(Math.max(Number(process.env.AYURVEDA_TOP_K ?? "6"), 1), 20);
const MAX_CHUNKS_SCAN = Math.min(
  Math.max(Number(process.env.AYURVEDA_MAX_CHUNKS ?? "3000"), 100),
  20_000
);

function embeddingFromJson(value: Prisma.JsonValue | null): number[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.every((x) => typeof x === "number") ? (value as number[]) : undefined;
}

function extractFirstJsonObject(text: string): any {
  const t = text.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Model output did not contain JSON.");
  const candidate = t.slice(start, end + 1);
  return JSON.parse(candidate);
}

function coerceCitations(
  citationsRaw: unknown,
  topMatches: Array<{ meta: any; content: string }>
): AyurvedaYogaRecommendation["citations"] {
  const citations = Array.isArray(citationsRaw) ? (citationsRaw as any[]) : [];
  const out: AyurvedaYogaRecommendation["citations"] = [];
  for (const c of citations) {
    const sourceId = String(c?.sourceId ?? "");
    let resolved = sourceId;
    const m = sourceId.match(/^SOURCE_(\d+)$/i);
    if (m) {
      const idx = Math.max(0, Number(m[1]) - 1);
      const meta = (topMatches[idx]?.meta ?? {}) as any;
      resolved = String(meta.sourceId ?? sourceId);
    }
    out.push({
      sourceId: resolved || sourceId || "unknown",
      sourceTitle: String(c?.sourceTitle ?? ""),
      url: String(c?.url ?? ""),
      quote: String(c?.quote ?? "")
    });
  }
  return out;
}

export type AyurvedaYogaRecommendation = {
  diseaseSlug: string;
  diseaseName: string;
  intent: string;
  asanas: Array<{
    name: string;
    purpose?: string;
    howTo?: string;
    duration?: string;
    frequency?: string;
  }>;
  pranayama: Array<{
    name: string;
    purpose?: string;
    howTo?: string;
    duration?: string;
    frequency?: string;
  }>;
  contraindications: string[];
  citations: Array<{
    sourceId: string;
    sourceTitle: string;
    url: string;
    quote: string;
  }>;
  meta: {
    llmProvider: string;
    embeddingProvider: string;
    indexedChunksScanned: number;
  };
};

export async function suggestAyurvedaYogaForDisease(
  diseaseSlug: string
): Promise<AyurvedaYogaRecommendation> {
  const disease = getDiseaseBySlug(diseaseSlug);
  if (!disease) throw new Error(`Unknown disease slug: ${diseaseSlug}`);

  const query =
    `${disease.name}. Suggest yoga asanas and pranayama suitable for this condition ` +
    `from classical yoga/ayurveda texts, including precautions and contraindications.`;

  const queryVec = await embedText(query, { purpose: "query" });

  const corpus = await prisma.ragChunk.findMany({
    where: {
      question: {
        kind: QuestionKind.BANK,
        slug: { startsWith: "ayu_src_" }
      }
    },
    take: MAX_CHUNKS_SCAN,
    orderBy: { createdAt: "desc" }
  });

  const matches: Array<{
    id: string;
    score: number;
    content: string;
    meta: any;
  }> = [];

  for (const c of corpus) {
    const emb = embeddingFromJson(c.embedding);
    if (!emb?.length || emb.length !== queryVec.length) continue;
    matches.push({
      id: c.id,
      score: cosineSimilarity(queryVec, emb),
      content: c.content,
      meta: c.meta
    });
  }

  matches.sort((a, b) => b.score - a.score);
  const top = matches.slice(0, TOP_K);
  if (!top.length) {
    throw new Error(
      "Ayurveda corpus is empty (or embedding mismatch). Run `npm run db:train-ayurveda` with the same RAG_EMBEDDING_PROVIDER, then retry."
    );
  }

  const context = top
    .map((m, i) => {
      const meta = (m.meta ?? {}) as any;
      const srcTitle = String(meta.sourceTitle ?? "Unknown source");
      const srcId = String(meta.sourceId ?? "unknown");
      const url = String(meta.sourceUrl ?? "");
      const quote = String(m.content).slice(0, 700);
      return [
        `SOURCE_${i + 1}`,
        `sourceId: ${srcId}`,
        `sourceTitle: ${srcTitle}`,
        `url: ${url}`,
        `quote: ${quote}`
      ].join("\n");
    })
    .join("\n");

  const system = [
    "You are an Ayurveda-aligned yoga and pranayama recommender.",
    "You must output ONLY valid JSON (no markdown, no extra text).",
    "Do NOT suggest gym/exercise routines. Only yoga asanas and pranayama/breathwork.",
    "Be conservative: include contraindications and safety notes.",
    "Use the provided sources as grounding. Every recommendation must cite at least one source.",
    "",
    "Return JSON with this exact shape:",
    "{",
    '  "diseaseSlug": string,',
    '  "diseaseName": string,',
    '  "intent": string,',
    '  "asanas": [{"name": string, "purpose"?: string, "howTo"?: string, "duration"?: string, "frequency"?: string}],',
    '  "pranayama": [{"name": string, "purpose"?: string, "howTo"?: string, "duration"?: string, "frequency"?: string}],',
    '  "contraindications": string[],',
    '  "citations": [{"sourceId": string, "sourceTitle": string, "url": string, "quote": string}]',
    "}",
    "",
    "Rules:",
    "- Provide 3–8 asanas, 2–6 pranayama items.",
    "- citations.sourceId MUST be one of the provided sourceId values above (NOT SOURCE_1, SOURCE_2, ...).",
    "- citations.quote MUST be copied exactly (or a contiguous substring) from the provided quote blocks (not invented).",
    "- If sources do not explicitly mention a disease, infer conservatively and cite general guidance passages about pranayama/asana safety.",
  ].join("\n");

  const user = [
    `Disease: ${disease.name} (slug: ${disease.slug})`,
    "",
    "Grounding sources:",
    context
  ].join("\n");

  const llm = await synthesizeFreeLlm(system, user);
  if (!llm.text) {
    throw new Error(
      `No LLM configured (or call failed). Set GROQ_API_KEY (preferred) or GEMINI_API_KEY. ${llm.lastError ? `Last error: ${llm.lastError}` : ""}`.trim()
    );
  }

  const parsed = extractFirstJsonObject(llm.text);

  // Force required fields + attach meta; keep the model payload mostly as-is.
  const result: AyurvedaYogaRecommendation = {
    diseaseSlug: String(parsed.diseaseSlug ?? disease.slug),
    diseaseName: String(parsed.diseaseName ?? disease.name),
    intent: String(parsed.intent ?? "Yoga and pranayama suggestions (educational)."),
    asanas: Array.isArray(parsed.asanas) ? parsed.asanas : [],
    pranayama: Array.isArray(parsed.pranayama) ? parsed.pranayama : [],
    contraindications: Array.isArray(parsed.contraindications) ? parsed.contraindications : [],
    citations: coerceCitations(parsed.citations, top),
    meta: {
      llmProvider: llm.provider,
      embeddingProvider: getActiveEmbedProvider(),
      indexedChunksScanned: corpus.length
    }
  };

  return result;
}

