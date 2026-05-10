import type { Prisma } from "@prisma/client";
import { QuestionKind } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { RAG_QUESTION_BANK_100 } from "../../questions/bank100.js";
import { rebuildWikipediaCorpusForQuestion } from "./corpusIndex.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runTrainQuestionBank(): Promise<void> {
  const delay = Math.max(
    0,
    Number.parseInt(String(process.env.TRAIN_BANK_DELAY_MS ?? "700"), 10) || 0
  );
  const force = process.env.FORCE_TRAIN_BANK === "1";

  let indexed = 0;
  let skipped = 0;
  let failed = 0;

  const run = await prisma.ragTrainingRun.create({
    data: {
      label: "question-bank-100",
      status: "running"
    }
  });

  process.stderr.write(
    `[trainQuestionBank] Training ${RAG_QUESTION_BANK_100.length} bank prompts (force=${force}, delayMs=${delay}). runId=${run.id}\n`
  );

  try {
    for (const entry of RAG_QUESTION_BANK_100) {
      const title =
        entry.prompt.length > 200 ? `${entry.prompt.slice(0, 197)}…` : entry.prompt;

      const row = await prisma.question.upsert({
        where: { slug: entry.slug },
        create: {
          slug: entry.slug,
          title,
          promptText: entry.prompt,
          kind: QuestionKind.BANK
        },
        update: {
          title,
          promptText: entry.prompt,
          kind: QuestionKind.BANK
        }
      });

      const existing = await prisma.ragChunk.count({
        where: { questionId: row.id }
      });

      if (!force && existing > 0) {
        skipped++;
        process.stderr.write(`  skip ${entry.slug} (already ${existing} chunks)\n`);
        await sleep(delay);
        continue;
      }

      try {
        const n = await rebuildWikipediaCorpusForQuestion(row.id, entry.prompt);
        indexed++;
        process.stderr.write(`  ok   ${entry.slug} → ${n} chunks\n`);
      } catch (e) {
        failed++;
        console.error(`  FAIL ${entry.slug}`, e);
      }

      await sleep(delay);
    }

    const metrics: Prisma.InputJsonValue = { indexed, skipped, failed };
    await prisma.ragTrainingRun.update({
      where: { id: run.id },
      data: {
        status: failed > 0 ? "completed_with_errors" : "completed",
        finishedAt: new Date(),
        metrics
      }
    });

    process.stderr.write(
      `[trainQuestionBank] Done. indexed=${indexed} skipped=${skipped} failed=${failed}\n`
    );
  } catch (e) {
    await prisma.ragTrainingRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        metrics: { error: String(e) } as Prisma.InputJsonValue
      }
    });
    throw e;
  }
}
