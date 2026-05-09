/**
 * Embeds & inserts curated web-informed chunks into CorpusEntry for each RAG slug.
 * Idempotent via unique meta.chunkId per question namespace.
 *
 * Usage (after migrate + baseline seed Questions exist):
 *   npx tsx prisma/enrichCorpus.ts
 * Or: npm run db:enrich
 *
 * Requires DATABASE_URL and works with free local embeddings unless you force OpenAI.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { webCuratedChunks } from "../src/rag/webCuratedChunks.js";
import { embedText } from "../src/rag/embed.js";

async function hasChunk(questionId: string, chunkId: string): Promise<boolean> {
  const rows = await prisma.corpusEntry.findMany({
    where: { questionId },
    select: { meta: true }
  });
  return rows.some((r) => {
    const m = r.meta as { chunkId?: string } | null;
    return m?.chunkId === chunkId;
  });
}

async function main() {
  process.stderr.write(
    `[enrichCorpus] Embedding provider hint: embeddings run via rag/embed (~${process.env.RAG_EMBEDDING_PROVIDER ?? "auto"}).\n`
  );
  let added = 0;
  let skipped = 0;
  for (const chunk of webCuratedChunks) {
    const q = await prisma.question.findUnique({ where: { slug: chunk.slug } });
    if (!q) {
      process.stderr.write(
        `[enrichCorpus] Skip: Question slug not in DB "${chunk.slug}" — run npm run db:seed first.\n`
      );
      continue;
    }
    if (await hasChunk(q.id, chunk.chunkId)) {
      skipped++;
      continue;
    }
    const vector = await embedText(chunk.text);
    const meta: Prisma.InputJsonValue = {
      chunkId: chunk.chunkId,
      kind: "web-curated-synthesis",
      citations: chunk.citations
    };
    await prisma.corpusEntry.create({
      data: {
        questionId: q.id,
        content: chunk.text,
        meta,
        embedding: vector as unknown as Prisma.InputJsonValue
      }
    });
    added++;
    process.stderr.write(`  + ${chunk.slug} :: ${chunk.chunkId}\n`);
  }
  process.stderr.write(`[enrichCorpus] Done. Added ${added}, skipped (exists) ${skipped}.\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
