-- CreateEnum
CREATE TYPE "QuestionKind" AS ENUM ('BANK', 'DYNAMIC', 'MANUAL_REF');

-- CreateEnum
CREATE TYPE "AnswerSource" AS ENUM ('MANUAL_Q2', 'MANUAL_Q3', 'MANUAL_Q4', 'WEB_RAG', 'BANK_RAG');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "kind" "QuestionKind" NOT NULL DEFAULT 'DYNAMIC';

UPDATE "Question" SET "kind" = 'BANK' WHERE "slug" LIKE 'qb\_%' ESCAPE '\';

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT,
    "source" "AnswerSource" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RagTrainingRun" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "metrics" JSONB,

    CONSTRAINT "RagTrainingRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE INDEX "Answer_source_idx" ON "Answer"("source");

-- CreateIndex
CREATE INDEX "RagTrainingRun_startedAt_idx" ON "RagTrainingRun"("startedAt");

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
