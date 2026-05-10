/**
 * Indexes Wikipedia-backed chunks for all 100 bank questions (embeddings + Postgres).
 *
 *   npm run db:train-bank
 *
 * Env: FORCE_TRAIN_BANK, TRAIN_BANK_DELAY_MS
 */
import { prisma } from "../src/lib/prisma.js";
import { runTrainQuestionBank } from "../src/rag/training/trainQuestionBank.js";

runTrainQuestionBank()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
