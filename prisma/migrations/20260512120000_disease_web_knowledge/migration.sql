-- Disease knowledge tables (Wikipedia ETL + ML heuristics). Slugs match `src/diseases/registry.ts`.

CREATE TABLE "DiseaseWebInfo" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "wikipediaTitle" TEXT,
    "summary" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sectionsJson" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiseaseWebInfo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiseaseWebInfo_slug_key" ON "DiseaseWebInfo"("slug");

CREATE TABLE "DiseaseSpecialistInfo" (
    "id" TEXT NOT NULL,
    "diseaseSlug" TEXT NOT NULL,
    "specialistType" TEXT NOT NULL,
    "roleDescription" TEXT NOT NULL,
    "whenToSee" TEXT,
    "sourceExcerpt" TEXT,
    "sourceSection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiseaseSpecialistInfo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiseaseSpecialistInfo_diseaseSlug_idx" ON "DiseaseSpecialistInfo"("diseaseSlug");

CREATE TABLE "DiseaseYogaPranayamInfo" (
    "id" TEXT NOT NULL,
    "diseaseSlug" TEXT NOT NULL,
    "practiceName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cautionNote" TEXT,
    "sourceExcerpt" TEXT,
    "sourceSection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiseaseYogaPranayamInfo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiseaseYogaPranayamInfo_diseaseSlug_idx" ON "DiseaseYogaPranayamInfo"("diseaseSlug");

CREATE TABLE "DiseaseCriticalityProfile" (
    "id" TEXT NOT NULL,
    "diseaseSlug" TEXT NOT NULL,
    "criticalityPercent" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiseaseCriticalityProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiseaseCriticalityProfile_diseaseSlug_key" ON "DiseaseCriticalityProfile"("diseaseSlug");
