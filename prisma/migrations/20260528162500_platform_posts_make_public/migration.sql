ALTER TABLE "DiseasePost" ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC';
UPDATE "DiseasePost" SET "visibility" = 'PUBLIC' WHERE "visibility" <> 'PUBLIC';

