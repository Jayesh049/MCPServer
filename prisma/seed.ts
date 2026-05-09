import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as appPrisma } from "../src/lib/prisma.js";
import { ragQuestionCatalog } from "../src/questions/catalog.js";
import { ragPrimersBySlug } from "../src/rag/ragPrimers.js";
import { embedText } from "../src/rag/embed.js";

async function seedQuestions(db: PrismaClient) {
  for (const q of ragQuestionCatalog) {
    await db.question.upsert({
      where: { slug: q.slug },
      update: { title: q.title },
      create: { slug: q.slug, title: q.title }
    });
  }
}

/** Index-on-disk primers only when the corpus for that slug is empty (first seed / wiped DB). */
async function seedPrimersIfEmpty(db: PrismaClient) {
  process.stderr.write(
    "Seeding RAG primers (local or OpenAI embeddings — first model load may download weights)...\n"
  );
  for (const q of ragQuestionCatalog) {
    const row = await db.question.findUnique({ where: { slug: q.slug } });
    if (!row) continue;
    const existing = await db.corpusEntry.count({ where: { questionId: row.id } });
    if (existing > 0) continue;
    const primers = ragPrimersBySlug[q.slug];
    if (!primers?.length) continue;
    for (const text of primers) {
      const vec = await embedText(text);
      await db.corpusEntry.create({
        data: {
          questionId: row.id,
          content: text,
          meta: { primer: true, slug: q.slug } as Prisma.InputJsonValue,
          embedding: vec as unknown as Prisma.InputJsonValue
        }
      });
    }
    process.stderr.write(`  Primers for ${q.slug}: ${primers.length}\n`);
  }
}

async function main() {
  await seedQuestions(appPrisma);
  await seedPrimersIfEmpty(appPrisma);
}

main()
  .then(() => appPrisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await appPrisma.$disconnect();
    process.exit(1);
  });
