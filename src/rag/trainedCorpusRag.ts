import type { Prisma } from "@prisma/client";
import { QuestionKind } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AnswerSource, persistAnswerSafe } from "../answers/persist.js";
import type { EmbedProvider } from "./embed.js";
import { embedText, getActiveEmbedProvider } from "./embed.js";
import { cosineSimilarity } from "./similarity.js";
import { normalizeQuestionText, questionSlugFromText } from "./questionSlug.js";
import type { WebRagMatch } from "./dynamicWebRag.js";

const TOP_K = Math.min(
  Math.max(Number.parseInt(String(process.env.RAG_TOP_K ?? "5"), 10) || 5, 1),
  50
);

/** Max chunks scored per request (safety cap on large corpora). */
const MAX_CHUNKS_SCAN = Math.min(
  Math.max(Number.parseInt(String(process.env.RAG_TRAINED_MAX_CHUNKS ?? "2500"), 10) || 2500, 100),
  20_000
);

export type TrainedCorpusRagResult = {
  slug: string;
  question: string;
  embeddingProvider: EmbedProvider;
  webSource: "trained_corpus";
  /** Chunks in DB from the trained bank (not live web). */
  indexedChunks: number;
  refreshed: false;
  topMatches: WebRagMatch[];
  answerPreview: string;
  /** Bank slug of the best-matching trained topic, if any. */
  matchedBankSlug?: string;
};

function embeddingFromJson(value: Prisma.JsonValue | null): number[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  const nums = value.every((x) => typeof x === "number");
  return nums ? (value as number[]) : undefined;
}

/**
 * Retrieve from **pre-trained** `RagChunk` rows (question bank `qb_*` in Postgres).
 * No Wikipedia (or any web) fetch at query time.
 *
 * Train once: `npm run db:train-bank` (indexes 100 health prompts into Neon).
 */
export async function answerQuestionWithTrainedCorpus(
  questionRaw: string
): Promise<TrainedCorpusRagResult> {
  const question = normalizeQuestionText(questionRaw);
  if (question.length < 3) {
    throw new Error("Question must be at least 3 characters.");
  }

  const slug = questionSlugFromText(question);
  const title = question.length > 200 ? `${question.slice(0, 197)}…` : question;

  let row = await prisma.question.findUnique({ where: { slug } });
  if (!row) {
    row = await prisma.question.create({
      data: {
        slug,
        title,
        promptText: question,
        kind: QuestionKind.DYNAMIC
      }
    });
  }

  const bankChunkCount = await prisma.ragChunk.count({
    where: { question: { kind: QuestionKind.BANK } }
  });

  if (bankChunkCount === 0) {
    throw new Error(
      "Trained RAG corpus is empty. Run `npm run db:train-bank` against this DATABASE_URL (takes ~10–30 min), then try again."
    );
  }

  const queryVec = await embedText(question, { purpose: "query" });

  const corpus = await prisma.ragChunk.findMany({
    where: { question: { kind: QuestionKind.BANK } },
    take: MAX_CHUNKS_SCAN,
    orderBy: { createdAt: "desc" },
    include: {
      question: { select: { slug: true, promptText: true } }
    }
  });

  const matches: Array<WebRagMatch & { bankSlug?: string }> = [];
  for (const c of corpus) {
    const emb = embeddingFromJson(c.embedding);
    if (!emb?.length || emb.length !== queryVec.length) continue;
    matches.push({
      id: c.id,
      score: cosineSimilarity(queryVec, emb),
      content: c.content,
      meta: c.meta,
      createdAt: c.createdAt.toISOString(),
      bankSlug: c.question.slug
    });
  }

  matches.sort((a, b) => b.score - a.score);
  const topMatches = matches.slice(0, TOP_K);

  if (topMatches.length === 0) {
    throw new Error(
      "No scored chunks (embedding dimension mismatch?). Re-run `npm run db:train-bank` with the same RAG_EMBEDDING_PROVIDER as production."
    );
  }

  const answerPreview = topMatches
    .map((m, i) => `(${i + 1}) ${m.content.slice(0, 600)}${m.content.length > 600 ? "…" : ""}`)
    .join("\n\n");

  const result: TrainedCorpusRagResult = {
    slug,
    question,
    embeddingProvider: getActiveEmbedProvider(),
    webSource: "trained_corpus",
    indexedChunks: bankChunkCount,
    refreshed: false,
    topMatches,
    answerPreview,
    matchedBankSlug: topMatches[0]?.bankSlug
  };

  persistAnswerSafe({
    questionId: row.id,
    source: AnswerSource.BANK_RAG,
    payload: { ...result, patientQuery: question }
  });

  return result;
}
