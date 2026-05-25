-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DOCTOR', 'PATIENT');

-- CreateEnum
CREATE TYPE "DoctorStatus" AS ENUM ('ONLINE', 'BUSY', 'AWAY', 'OFFLINE');

-- CreateTable
CREATE TABLE "PlatformUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformDoctor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "regNo" TEXT NOT NULL,
    "hospital" TEXT,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "degreeFiles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.8,
    "totalConsults" INTEGER NOT NULL DEFAULT 0,
    "bio" TEXT,
    "fee" INTEGER NOT NULL DEFAULT 500,
    "status" "DoctorStatus" NOT NULL DEFAULT 'ONLINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformDoctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPatient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "age" INTEGER,
    "bloodGroup" TEXT,
    "city" TEXT,
    "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "PlatformPatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiseasePost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiseasePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorReply" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformTip" (
    "id" TEXT NOT NULL,
    "giverId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "replyId" TEXT,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultMessage" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_email_key" ON "PlatformUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformDoctor_userId_key" ON "PlatformDoctor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPatient_userId_key" ON "PlatformPatient"("userId");

-- CreateIndex
CREATE INDEX "DiseasePost_authorId_idx" ON "DiseasePost"("authorId");

-- CreateIndex
CREATE INDEX "DiseasePost_createdAt_idx" ON "DiseasePost"("createdAt");

-- CreateIndex
CREATE INDEX "DoctorReply_postId_idx" ON "DoctorReply"("postId");

-- CreateIndex
CREATE INDEX "DoctorReply_doctorId_idx" ON "DoctorReply"("doctorId");

-- CreateIndex
CREATE INDEX "PlatformTip_receiverId_idx" ON "PlatformTip"("receiverId");

-- CreateIndex
CREATE INDEX "Consultation_user1Id_user2Id_idx" ON "Consultation"("user1Id", "user2Id");

-- CreateIndex
CREATE INDEX "ConsultMessage_consultationId_idx" ON "ConsultMessage"("consultationId");

-- AddForeignKey
ALTER TABLE "PlatformDoctor" ADD CONSTRAINT "PlatformDoctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPatient" ADD CONSTRAINT "PlatformPatient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseasePost" ADD CONSTRAINT "DiseasePost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorReply" ADD CONSTRAINT "DoctorReply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "DiseasePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorReply" ADD CONSTRAINT "DoctorReply_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformTip" ADD CONSTRAINT "PlatformTip_giverId_fkey" FOREIGN KEY ("giverId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformTip" ADD CONSTRAINT "PlatformTip_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformTip" ADD CONSTRAINT "PlatformTip_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "DoctorReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultMessage" ADD CONSTRAINT "ConsultMessage_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
