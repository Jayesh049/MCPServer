-- AlterTable
ALTER TABLE "PlatformUser" ADD COLUMN "googleId" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_googleId_key" ON "PlatformUser"("googleId");
