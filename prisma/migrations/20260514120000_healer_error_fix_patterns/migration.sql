-- CreateEnum
CREATE TYPE "HealerTechStack" AS ENUM ('NODE_TS', 'NEXT', 'PYTHON');

-- CreateEnum
CREATE TYPE "HealerFixSource" AS ENUM ('LLM', 'MANUAL', 'CACHE');

-- CreateTable
CREATE TABLE "ErrorFixPattern" (
    "id" TEXT NOT NULL,
    "techStack" "HealerTechStack" NOT NULL,
    "patternHash" TEXT NOT NULL,
    "primaryFilePath" TEXT,
    "normalizedSnippet" TEXT NOT NULL,
    "rawSnippetPreview" TEXT,
    "fixPayload" JSONB NOT NULL,
    "createdFrom" "HealerFixSource" NOT NULL DEFAULT 'LLM',
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "missCount" INTEGER NOT NULL DEFAULT 0,
    "lastAppliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorFixPattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErrorFixPattern_techStack_patternHash_key" ON "ErrorFixPattern"("techStack", "patternHash");

-- CreateIndex
CREATE INDEX "ErrorFixPattern_techStack_idx" ON "ErrorFixPattern"("techStack");

-- CreateIndex
CREATE INDEX "ErrorFixPattern_patternHash_idx" ON "ErrorFixPattern"("patternHash");
