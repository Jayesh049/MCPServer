import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { embedText } from "../embed.js";
import { chunkText } from "../textChunks.js";
import { fetchCorpusFromWikipedia } from "../wikipediaFetch.js";

async function deleteChunksForQuestion(questionId: string) {
  await prisma.ragChunk.deleteMany({ where: { questionId } });
}

/**
 * Deletes existing chunks, fetches Wikipedia intros for `searchQuery`, chunks + embed + store (`RagChunk`).
 */
export async function rebuildWikipediaCorpusForQuestion(
  questionId: string,
  searchQuery: string
): Promise<number> {
  const q = searchQuery.trim();
  let articles: Awaited<ReturnType<typeof fetchCorpusFromWikipedia>> = [];
  try {
    articles = await fetchCorpusFromWikipedia(q);
  } catch (e) {
    console.warn("[rag/training/corpusIndex] Wikipedia fetch failed; using fallback chunk.", e);
    articles = [];
  }

  if (!articles.length) {
    const fallback =
      `[Educational placeholder — no Wikipedia results for this exact query]\n` +
      `Topic focus: "${q.slice(0, 500)}". For accurate medical decisions, use licensed clinicians and authoritative guidelines; this demo index is synthetic.`;
    const vec = await embedText(fallback, { purpose: "corpus" });
    const meta: Prisma.InputJsonValue = {
      kind: "fallback-primer",
      searchQuery: q
    };
    await prisma.ragChunk.create({
      data: {
        questionId,
        content: fallback,
        meta,
        embedding: vec as unknown as Prisma.InputJsonValue
      }
    });
    return 1;
  }

  await deleteChunksForQuestion(questionId);

  let chunkIndex = 0;
  let added = 0;
  for (const art of articles) {
    const pieces = chunkText(art.excerpt, 900);
    for (const piece of pieces) {
      const content = `[${art.title}]\n${piece}`;
      const vec = await embedText(content, { purpose: "corpus" });
      const meta: Prisma.InputJsonValue = {
        kind: "wikipedia-chunk",
        articleTitle: art.title,
        pageUrl: art.pageUrl,
        chunkIndex: chunkIndex++
      };
      await prisma.ragChunk.create({
        data: {
          questionId,
          content,
          meta,
          embedding: vec as unknown as Prisma.InputJsonValue
        }
      });
      added++;
    }
  }
  return added;
}
