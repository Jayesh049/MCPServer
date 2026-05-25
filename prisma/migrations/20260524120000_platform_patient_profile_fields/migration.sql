-- AlterTable
ALTER TABLE "PlatformPatient" ADD COLUMN IF NOT EXISTS "languages" TEXT;
ALTER TABLE "PlatformPatient" ADD COLUMN IF NOT EXISTS "medications" TEXT;
