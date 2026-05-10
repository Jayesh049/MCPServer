import type { Prisma } from "@prisma/client";
import { QuestionKind } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AnswerSource, persistAnswerSafe } from "../answers/persist.js";
import { rebuildWikipediaCorpusForQuestion } from "./training/corpusIndex.js";
import type { EmbedProvider } from "./embed.js";
import { embedText, getActiveEmbedProvider } from "./embed.js";
import { geminiSynthesizeRagAnswer, isRagGeminiSynthesisEnabled } from "./gemini.js";
import { cosineSimilarity } from "./similarity.js";
import { normalizeQuestionText, questionSlugFromText } from "./questionSlug.js";

const TOP_K = Math.min(
  Math.max(Number.parseInt(String(process.env.RAG_TOP_K ?? "5"), 10) || 5, 1),
  50
);

export type WebRagMatch = {
  id: string;
  score: number;
  content: string;
  meta: unknown;
  createdAt: string;
};

export type DynamicWebRagResult = {
  slug: string;
  question: string;
  embeddingProvider: EmbedProvider;
  webSource: "wikipedia";
  indexedChunks: number;
  refreshed: boolean;
  topMatches: WebRagMatch[];
  /** Short synthesis hint: concatenation of top snippets for the agent (not an LLM summary). */
  answerPreview: string;
  /** Gemini-generated answer when `RAG_GEMINI_SYNTHESIS=1` and `GEMINI_API_KEY` is set. */
  geminiAnswer?: string;
};

function embeddingFromJson(value: Prisma.JsonValue | null): number[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  const nums = value.every((x) => typeof x === "number");
  return nums ? (value as number[]) : undefined;
}

/**
 * For a natural-language question: optionally fetch Wikipedia intros, chunk + embed + store,
 * then retrieve top-K chunks by cosine similarity to the question embedding (free local embed by default).
 */
export async function answerQuestionWithWebRag(
  questionRaw: string,
  options?: { refresh?: boolean; /** Use an existing Question slug (e.g. qb_001 from the bank) instead of hashing the text. */ useSlug?: string }
): Promise<DynamicWebRagResult> {
  const question = normalizeQuestionText(questionRaw);
  if (question.length < 3) {
    throw new Error("Question must be at least 3 characters.");
  }

  const slug = options?.useSlug?.trim() || questionSlugFromText(question);
  const title =
    question.length > 200 ? `${question.slice(0, 197)}…` : question;

  let row = await prisma.question.findUnique({ where: { slug } });
  const refresh = options?.refresh === true;

  let indexedChunks = 0;
  let refreshed = false;

  if (!row) {
    row = await prisma.question.create({
      data: {
        slug,
        title,
        promptText: question,
        kind: QuestionKind.DYNAMIC
      }
    });
  } else if (!options?.useSlug && row.promptText !== question) {
    await prisma.question.update({
      where: { id: row.id },
      data: { title, promptText: question }
    });
  }

  const corpusCount = await prisma.ragChunk.count({
    where: { questionId: row.id }
  });

  const needsIndex = refresh || corpusCount === 0;

  if (needsIndex) {
    refreshed = corpusCount > 0 || refresh;
    indexedChunks = await rebuildWikipediaCorpusForQuestion(row.id, question);
  } else {
    indexedChunks = corpusCount;
  }

  const queryVec = await embedText(question, { purpose: "query" });
  const corpus = await prisma.ragChunk.findMany({
    where: { questionId: row.id }
  });

  const scored: WebRagMatch[] = [];
  for (const c of corpus) {
    const emb = embeddingFromJson(c.embedding);
    if (!emb?.length || emb.length !== queryVec.length) continue;
    scored.push({
      id: c.id,
      score: cosineSimilarity(queryVec, emb),
      content: c.content,
      meta: c.meta,
      createdAt: c.createdAt.toISOString()
    });
  }
  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, TOP_K);

  const answerPreview = topMatches
    .map((m, i) => `(${i + 1}) ${m.content.slice(0, 600)}${m.content.length > 600 ? "…" : ""}`)
    .join("\n\n");

  let geminiAnswer: string | undefined;
  if (isRagGeminiSynthesisEnabled() && topMatches.length > 0) {
    try {
      geminiAnswer = await geminiSynthesizeRagAnswer(
        question,
        topMatches.map((m) => m.content)
      );
    } catch (e) {
      console.warn("[dynamicWebRag] Gemini synthesis skipped:", e);
    }
  }

  const result: DynamicWebRagResult = {
    slug,
    question,
    embeddingProvider: getActiveEmbedProvider(),
    webSource: "wikipedia",
    indexedChunks,
    refreshed,
    topMatches,
    answerPreview,
    ...(geminiAnswer ? { geminiAnswer } : {})
  };

  persistAnswerSafe({
    questionId: row.id,
    source: slug.startsWith("qb_") ? AnswerSource.BANK_RAG : AnswerSource.WEB_RAG,
    payload: result
  });

  return result;
}

/** Load a pre-seeded bank row (`qb_*`) and run the same RAG pipeline on its stored prompt. */
export async function answerQuestionByBankSlug(
  bankSlug: string,
  options?: { refresh?: boolean }
): Promise<DynamicWebRagResult> {
  const row = await prisma.question.findUnique({
    where: { slug: bankSlug.trim() }
  });
  const prompt = row?.promptText?.trim();
  if (!prompt || prompt.length < 3) {
    throw new Error(`Unknown bank slug or empty prompt: ${bankSlug}`);
  }
  return answerQuestionWithWebRag(prompt, { ...options, useSlug: bankSlug.trim() });
}
