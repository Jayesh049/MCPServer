-- Enums
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "PostVisibility" AS ENUM ('DOCTORS_ONLY', 'PRIVATE');
CREATE TYPE "ConsultationStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'CLOSED', 'REJECTED');
CREATE TYPE "RatingStatus" AS ENUM ('PENDING_VALIDATION', 'APPROVED', 'FLAGGED', 'REJECTED');

-- Alter existing tables
ALTER TABLE "DiseasePost"
ADD COLUMN "visibility" "PostVisibility" NOT NULL DEFAULT 'DOCTORS_ONLY';

ALTER TABLE "Consultation"
ADD COLUMN "status" "ConsultationStatus" NOT NULL DEFAULT 'REQUESTED',
ADD COLUMN "requestedById" TEXT,
ADD COLUMN "requestPostId" TEXT,
ADD COLUMN "requestReplyId" TEXT,
ADD COLUMN "patientConsentedRecording" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "doctorConsentedRecording" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- New tables
CREATE TABLE "DoctorVerification" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'digilocker',
  "digilockerUserId" TEXT,
  "documentUri" TEXT,
  "documentHash" TEXT,
  "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "rawMeta" JSONB,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsultationCallRecording" (
  "id" TEXT NOT NULL,
  "consultationId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "recordingUrl" TEXT,
  "storageKey" TEXT,
  "durationSeconds" INTEGER,
  "transcript" TEXT,
  "patientConsented" BOOLEAN NOT NULL DEFAULT false,
  "doctorConsented" BOOLEAN NOT NULL DEFAULT false,
  "callStartedAt" TIMESTAMP(3),
  "callEndedAt" TIMESTAMP(3),
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsultationCallRecording_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DoctorRating" (
  "id" TEXT NOT NULL,
  "consultationId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "formAnswers" JSONB NOT NULL,
  "signature" TEXT,
  "status" "RatingStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorRating_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientRating" (
  "id" TEXT NOT NULL,
  "consultationId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "formAnswers" JSONB NOT NULL,
  "signature" TEXT,
  "status" "RatingStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientRating_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RatingValidationRun" (
  "id" TEXT NOT NULL,
  "doctorRatingId" TEXT,
  "patientRatingId" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL,
  "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "evidenceSummary" TEXT,
  "autoDecision" "RatingStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
  "reviewedById" TEXT,
  "reviewerDecision" "RatingStatus",
  "reviewerNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "RatingValidationRun_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "DoctorVerification_doctorId_status_idx" ON "DoctorVerification" ("doctorId", "status");
CREATE INDEX "ConsultationCallRecording_consultationId_createdAt_idx" ON "ConsultationCallRecording" ("consultationId", "createdAt");
CREATE UNIQUE INDEX "DoctorRating_consultationId_patientId_doctorId_key" ON "DoctorRating" ("consultationId", "patientId", "doctorId");
CREATE INDEX "DoctorRating_doctorId_status_idx" ON "DoctorRating" ("doctorId", "status");
CREATE UNIQUE INDEX "PatientRating_consultationId_doctorId_patientId_key" ON "PatientRating" ("consultationId", "doctorId", "patientId");
CREATE INDEX "PatientRating_patientId_status_idx" ON "PatientRating" ("patientId", "status");
CREATE INDEX "RatingValidationRun_doctorRatingId_idx" ON "RatingValidationRun" ("doctorRatingId");
CREATE INDEX "RatingValidationRun_patientRatingId_idx" ON "RatingValidationRun" ("patientRatingId");

-- FKs
ALTER TABLE "DoctorVerification"
ADD CONSTRAINT "DoctorVerification_doctorId_fkey"
FOREIGN KEY ("doctorId") REFERENCES "PlatformDoctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConsultationCallRecording"
ADD CONSTRAINT "ConsultationCallRecording_consultationId_fkey"
FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DoctorRating"
ADD CONSTRAINT "DoctorRating_consultationId_fkey"
FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DoctorRating"
ADD CONSTRAINT "DoctorRating_doctorId_fkey"
FOREIGN KEY ("doctorId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DoctorRating"
ADD CONSTRAINT "DoctorRating_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientRating"
ADD CONSTRAINT "PatientRating_consultationId_fkey"
FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientRating"
ADD CONSTRAINT "PatientRating_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientRating"
ADD CONSTRAINT "PatientRating_doctorId_fkey"
FOREIGN KEY ("doctorId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RatingValidationRun"
ADD CONSTRAINT "RatingValidationRun_doctorRatingId_fkey"
FOREIGN KEY ("doctorRatingId") REFERENCES "DoctorRating"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RatingValidationRun"
ADD CONSTRAINT "RatingValidationRun_patientRatingId_fkey"
FOREIGN KEY ("patientRatingId") REFERENCES "PatientRating"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RatingValidationRun"
ADD CONSTRAINT "RatingValidationRun_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
