-- Add new PostVisibility enum value if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PostVisibility' AND e.enumlabel = 'PUBLIC'
  ) THEN
    ALTER TYPE "PostVisibility" ADD VALUE 'PUBLIC';
  END IF;
END$$;

CREATE TABLE "PostComment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostLike" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PostComment_postId_createdAt_idx" ON "PostComment"("postId", "createdAt");
CREATE INDEX "PostComment_authorId_idx" ON "PostComment"("authorId");
CREATE INDEX "PostLike_userId_idx" ON "PostLike"("userId");
CREATE UNIQUE INDEX "PostLike_postId_userId_key" ON "PostLike"("postId", "userId");

ALTER TABLE "PostComment"
  ADD CONSTRAINT "PostComment_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "DiseasePost"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostComment"
  ADD CONSTRAINT "PostComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "PlatformUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostLike"
  ADD CONSTRAINT "PostLike_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "DiseasePost"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostLike"
  ADD CONSTRAINT "PostLike_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

