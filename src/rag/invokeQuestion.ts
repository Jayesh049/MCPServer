import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getRagQuestionHandler } from "../questions/registry.js";
import { embedText, getActiveEmbedProvider } from "./embed.js";
import { cosineSimilarity } from "./similarity.js";

const TOP_K = Math.min(
  Math.max(Number.parseInt(String(process.env.RAG_TOP_K ?? "5"), 10) || 5, 1),
  50
);

export type RagTopMatch = {
  id: string;
  score: number;
  content: string;
  meta: unknown;
  createdAt: string;
};

export type InvokeRagQuestionResult = {
  slug: string;
  embeddingProvider: "openai" | "local";
  inserted: {
    id: string;
    content: string;
    meta: unknown;
    createdAt: string;
  };
  topMatches: RagTopMatch[];
};

function embeddingFromJson(value: Prisma.JsonValue | null): number[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  const nums = value.every((x) => typeof x === "number");
  return nums ? (value as number[]) : undefined;
}

export async function invokeRagQuestion(
  slug: string,
  body: unknown
): Promise<InvokeRagQuestionResult> {
  const normalize = getRagQuestionHandler(slug);
  if (!normalize) {
    throw new Error(`Unknown RAG question slug: ${slug}`);
  }

  const { content, meta } = await normalize(body);

  const question = await prisma.question.findUnique({
    where: { slug }
  });
  if (!question) {
    throw new Error(
      `Question "${slug}" not found in database. Run migrations and prisma db seed (or prisma/seed).`
    );
  }

  const vector = await embedText(content);

  const created = await prisma.corpusEntry.create({
    data: {
      questionId: question.id,
      content,
      meta: meta as Prisma.InputJsonValue,
      embedding: vector as unknown as Prisma.InputJsonValue
    }
  });

  const corpus = await prisma.corpusEntry.findMany({
    where: { questionId: question.id }
  });

  const queryVec = vector;
  const scored: RagTopMatch[] = [];

  for (const row of corpus) {
    if (row.id === created.id) continue;
    const emb = embeddingFromJson(row.embedding);
    if (!emb?.length || emb.length !== queryVec.length) continue;
    const score = cosineSimilarity(queryVec, emb);
    scored.push({
      id: row.id,
      score,
      content: row.content,
      meta: row.meta,
      createdAt: row.createdAt.toISOString()
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, TOP_K);

  return {
    slug,
    embeddingProvider: getActiveEmbedProvider(),
    inserted: {
      id: created.id,
      content: created.content,
      meta: created.meta,
      createdAt: created.createdAt.toISOString()
    },
    topMatches
  };
}
