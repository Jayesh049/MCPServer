-- CreateEnum
CREATE TYPE "DiseaseTrainingAssetKind" AS ENUM ('PDF', 'IMAGE');

-- CreateTable
CREATE TABLE "DiseaseTrainingAsset" (
    "id" TEXT NOT NULL,
    "diseaseSlug" TEXT NOT NULL,
    "functionality" TEXT NOT NULL DEFAULT 'educational_triage_text',
    "kind" "DiseaseTrainingAssetKind" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "extractedText" TEXT,
    "trainingLabel" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiseaseTrainingAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiseaseFunctionalityConfig" (
    "id" TEXT NOT NULL,
    "diseaseSlug" TEXT NOT NULL,
    "functionality" TEXT NOT NULL,
    "formulaKey" TEXT NOT NULL,
    "hyperparams" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiseaseFunctionalityConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiseaseTrainedModel" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "artifactStorageKey" TEXT NOT NULL,
    "metrics" JSONB,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nSamples" INTEGER NOT NULL,

    CONSTRAINT "DiseaseTrainedModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiseaseTrainingAsset_diseaseSlug_functionality_sha256_key" ON "DiseaseTrainingAsset"("diseaseSlug", "functionality", "sha256");

-- CreateIndex
CREATE INDEX "DiseaseTrainingAsset_diseaseSlug_functionality_idx" ON "DiseaseTrainingAsset"("diseaseSlug", "functionality");

-- CreateIndex
CREATE UNIQUE INDEX "DiseaseFunctionalityConfig_diseaseSlug_functionality_key" ON "DiseaseFunctionalityConfig"("diseaseSlug", "functionality");

-- CreateIndex
CREATE INDEX "DiseaseFunctionalityConfig_diseaseSlug_idx" ON "DiseaseFunctionalityConfig"("diseaseSlug");

-- CreateIndex
CREATE INDEX "DiseaseTrainedModel_configId_trainedAt_idx" ON "DiseaseTrainedModel"("configId", "trainedAt");

-- AddForeignKey
ALTER TABLE "DiseaseTrainedModel" ADD CONSTRAINT "DiseaseTrainedModel_configId_fkey" FOREIGN KEY ("configId") REFERENCES "DiseaseFunctionalityConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Demo seed: Alzheimer's educational text pipeline uses tfidf_lr (replace id on conflict via upsert in app)
INSERT INTO "DiseaseFunctionalityConfig" ("id", "diseaseSlug", "functionality", "formulaKey", "hyperparams", "isActive", "createdAt", "updatedAt")
VALUES (
  'cm_demo_alzheimers_edu',
  'alzheimers',
  'educational_triage_text',
  'tfidf_lr',
  '{"vectorizer": {"max_features": 4000, "ngram_range": [1, 2]}}'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("diseaseSlug", "functionality") DO NOTHING;
