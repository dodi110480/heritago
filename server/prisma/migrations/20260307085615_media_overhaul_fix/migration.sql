/*
  Warnings:

  - You are about to drop the column `filePath` on the `Media` table. All the data in the column will be lost.
  - You are about to drop the column `fileSize` on the `Media` table. All the data in the column will be lost.
  - You are about to drop the column `filePath` on the `MediaVariant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Media" DROP COLUMN "filePath",
DROP COLUMN "fileSize",
ADD COLUMN     "checksumSha256" TEXT,
ADD COLUMN     "cropHeight" INTEGER,
ADD COLUMN     "cropWidth" INTEGER,
ADD COLUMN     "cropX" INTEGER,
ADD COLUMN     "cropY" INTEGER,
ADD COLUMN     "filesize" INTEGER,
ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "path" TEXT,
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "MediaVariant" DROP COLUMN "filePath",
ADD COLUMN     "path" TEXT;

-- CreateIndex
CREATE INDEX "Media_userId_idx" ON "Media"("userId");

-- CreateIndex
CREATE INDEX "Media_isCurrent_idx" ON "Media"("isCurrent");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
