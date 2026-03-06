/*
  Warnings:

  - The values [OCCU,EDUC,ENDO] on the enum `EventType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'ADDRESS';

-- AlterEnum
BEGIN;
CREATE TYPE "EventType_new" AS ENUM ('BIRT', 'CHR', 'BAPM', 'DEAT', 'BURI', 'CREM', 'MARR', 'DIV', 'ANUL', 'ENGA', 'ADOP', 'BARM', 'BASM', 'BLES', 'CHRA', 'CONF', 'FCOM', 'ORDN', 'NATU', 'EMIG', 'IMMI', 'CENS', 'PROB', 'WILL', 'GRAD', 'RETI', 'EVEN', 'BAPL', 'CONL', 'ENDL', 'SLGC', 'SLGS', 'RESI', 'MILI', 'CAST', 'DSCR', 'OTHER');
ALTER TABLE "Event" ALTER COLUMN "type" TYPE "EventType_new" USING ("type"::text::"EventType_new");
ALTER TYPE "EventType" RENAME TO "EventType_old";
ALTER TYPE "EventType_new" RENAME TO "EventType";
DROP TYPE "public"."EventType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "fileFormat" TEXT;

-- AlterTable
ALTER TABLE "MediaLink" ADD COLUMN     "communicationId" TEXT;

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "formTemplate" TEXT;

-- AlterTable
ALTER TABLE "PlaceTranslation" ADD COLUMN     "dateEnd" TIMESTAMP(3),
ADD COLUMN     "dateStart" TIMESTAMP(3),
ADD COLUMN     "dateType" "DatePrecision";

-- AlterTable
ALTER TABLE "SharedNote" ADD COLUMN     "personId" TEXT;

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "extensions" JSONB,
    "personId" TEXT,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "extensions" JSONB,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceEvent" (
    "sourceId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "role" TEXT,
    "placeId" TEXT,

    CONSTRAINT "SourceEvent_pkey" PRIMARY KEY ("sourceId","eventId")
);

-- CreateIndex
CREATE INDEX "Submission_treeId_idx" ON "Submission"("treeId");

-- CreateIndex
CREATE INDEX "Submission_submitterId_idx" ON "Submission"("submitterId");

-- CreateIndex
CREATE INDEX "Communication_treeId_idx" ON "Communication"("treeId");

-- CreateIndex
CREATE INDEX "Communication_senderId_idx" ON "Communication"("senderId");

-- CreateIndex
CREATE INDEX "SourceEvent_sourceId_idx" ON "SourceEvent"("sourceId");

-- CreateIndex
CREATE INDEX "SourceEvent_eventId_idx" ON "SourceEvent"("eventId");

-- AddForeignKey
ALTER TABLE "SharedNote" ADD CONSTRAINT "SharedNote_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "Submitter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEvent" ADD CONSTRAINT "SourceEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEvent" ADD CONSTRAINT "SourceEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEvent" ADD CONSTRAINT "SourceEvent_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
