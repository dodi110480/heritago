-- DropIndex
DROP INDEX "DnaMatch_personId_idx";

-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "childCount" INTEGER;

-- AlterTable
ALTER TABLE "Name" ADD COLUMN     "religion" TEXT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "religion" TEXT;

-- AlterTable
ALTER TABLE "Tree" ADD COLUMN     "author" TEXT,
ADD COLUMN     "publication" TEXT;

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "personId" TEXT,
    "submitterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Citation_evenType_idx" ON "Citation"("evenType");

-- CreateIndex
CREATE INDEX "DnaMatch_personId_confidence_idx" ON "DnaMatch"("personId", "confidence");

-- CreateIndex
CREATE INDEX "Place_latitude_longitude_idx" ON "Place"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "Submitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
