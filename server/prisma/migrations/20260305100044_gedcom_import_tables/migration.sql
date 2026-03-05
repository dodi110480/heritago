/*
  Warnings:

  - A unique constraint covering the columns `[treeId,personId,matchPersonId,provider]` on the table `DnaMatch` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Citation` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Event` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `Fact` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `updatedAt` to the `Place` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BIRT', 'CHR', 'DEAT', 'BURI', 'MARR', 'DIV', 'RESI', 'CENS', 'OCCU', 'EDUC', 'EMIG', 'IMMI', 'NATU', 'MILI', 'WILL', 'PROB', 'OTHER');

-- CreateEnum
CREATE TYPE "FactType" AS ENUM ('OCCUPATION', 'EDUCATION', 'RELIGION', 'NATIONALITY', 'TITLE', 'RESIDENCE', 'PROPERTY', 'MILITARY_SERVICE', 'DESCRIPTION', 'OTHER');

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_familyId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_personId_fkey";

-- DropForeignKey
ALTER TABLE "Fact" DROP CONSTRAINT "Fact_familyId_fkey";

-- DropForeignKey
ALTER TABLE "Fact" DROP CONSTRAINT "Fact_personId_fkey";

-- DropIndex
DROP INDEX "ChangeLog_action_idx";

-- DropIndex
DROP INDEX "DnaMatch_personId_matchPersonId_provider_key";

-- AlterTable
ALTER TABLE "Citation" ADD COLUMN     "chanDate" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dataDateEnd" TIMESTAMP(3),
ADD COLUMN     "dataDateStart" TIMESTAMP(3),
ADD COLUMN     "dataDateText" TEXT,
ADD COLUMN     "dataDateType" "DatePrecision",
ADD COLUMN     "evenPhrase" TEXT,
ADD COLUMN     "evenRole" TEXT,
ADD COLUMN     "evenRolePhrase" TEXT,
ADD COLUMN     "evenType" TEXT,
ADD COLUMN     "quay" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "type" TYPE "EventType" USING (
  CASE 
    WHEN "type" = 'BIRT' THEN 'BIRT'::"EventType"
    WHEN "type" = 'CHR' THEN 'CHR'::"EventType"
    WHEN "type" = 'DEAT' THEN 'DEAT'::"EventType"
    WHEN "type" = 'BURI' THEN 'BURI'::"EventType"
    WHEN "type" = 'MARR' THEN 'MARR'::"EventType"
    WHEN "type" = 'DIV' THEN 'DIV'::"EventType"
    WHEN "type" = 'RESI' THEN 'RESI'::"EventType"
    WHEN "type" = 'CENS' THEN 'CENS'::"EventType"
    WHEN "type" = 'OCCU' THEN 'OCCU'::"EventType"
    WHEN "type" = 'EDUC' THEN 'EDUC'::"EventType"
    WHEN "type" = 'EMIG' THEN 'EMIG'::"EventType"
    WHEN "type" = 'IMMI' THEN 'IMMI'::"EventType"
    WHEN "type" = 'NATU' THEN 'NATU'::"EventType"
    WHEN "type" = 'MILI' THEN 'MILI'::"EventType"
    WHEN "type" = 'WILL' THEN 'WILL'::"EventType"
    WHEN "type" = 'PROB' THEN 'PROB'::"EventType"
    ELSE 'OTHER'::"EventType"
  END
);

-- AlterTable
ALTER TABLE "Fact" ALTER COLUMN "type" TYPE "FactType" USING (
  CASE 
    WHEN "type" = 'OCCUPATION' THEN 'OCCUPATION'::"FactType"
    WHEN "type" = 'EDUCATION' THEN 'EDUCATION'::"FactType"
    WHEN "type" = 'RELIGION' THEN 'RELIGION'::"FactType"
    WHEN "type" = 'NATIONALITY' THEN 'NATIONALITY'::"FactType"
    WHEN "type" = 'TITLE' THEN 'TITLE'::"FactType"
    WHEN "type" = 'RESIDENCE' THEN 'RESIDENCE'::"FactType"
    WHEN "type" = 'PROPERTY' THEN 'PROPERTY'::"FactType"
    WHEN "type" = 'MILITARY_SERVICE' THEN 'MILITARY_SERVICE'::"FactType"
    WHEN "type" = 'DESCRIPTION' THEN 'DESCRIPTION'::"FactType"
    ELSE 'OTHER'::"FactType"
  END
);

-- AlterTable
ALTER TABLE "MediaLink" ADD COLUMN     "citationId" TEXT;

-- AlterTable
ALTER TABLE "NoteLink" ADD COLUMN     "citationId" TEXT,
ADD COLUMN     "placeId" TEXT;

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "chanDate" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "form" TEXT,
ADD COLUMN     "lang" TEXT,
ADD COLUMN     "level" INTEGER DEFAULT 0,
ADD COLUMN     "phrase" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "PlaceTranslation" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "form" TEXT,
    "lang" TEXT NOT NULL,

    CONSTRAINT "PlaceTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceIdentifier" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT,

    CONSTRAINT "PlaceIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitationText" (
    "id" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mime" TEXT,
    "lang" TEXT,

    CONSTRAINT "CitationText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitationIdentifier" (
    "id" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT,

    CONSTRAINT "CitationIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NameValidity" (
    "id" TEXT NOT NULL,
    "nameId" TEXT NOT NULL,
    "dateStart" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "dateType" "DatePrecision",

    CONSTRAINT "NameValidity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "AssociationRole",

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceIdentifier" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT,

    CONSTRAINT "SourceIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaVariant" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "filePath" TEXT,
    "mimeType" TEXT,
    "variant" TEXT,

    CONSTRAINT "MediaVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonIdentifier" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT,

    CONSTRAINT "PersonIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportPerson" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "gedcomXref" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportFamily" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "gedcomXref" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportEvent" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "gedcomXref" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportSource" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "gedcomXref" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GedcomXrefMap" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "xref" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GedcomXrefMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaceTranslation_placeId_idx" ON "PlaceTranslation"("placeId");

-- CreateIndex
CREATE INDEX "PlaceIdentifier_placeId_idx" ON "PlaceIdentifier"("placeId");

-- CreateIndex
CREATE INDEX "CitationText_citationId_idx" ON "CitationText"("citationId");

-- CreateIndex
CREATE INDEX "CitationIdentifier_citationId_idx" ON "CitationIdentifier"("citationId");

-- CreateIndex
CREATE INDEX "NameValidity_nameId_idx" ON "NameValidity"("nameId");

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_idx" ON "EventParticipant"("eventId");

-- CreateIndex
CREATE INDEX "EventParticipant_personId_idx" ON "EventParticipant"("personId");

-- CreateIndex
CREATE INDEX "SourceIdentifier_sourceId_idx" ON "SourceIdentifier"("sourceId");

-- CreateIndex
CREATE INDEX "MediaVariant_mediaId_idx" ON "MediaVariant"("mediaId");

-- CreateIndex
CREATE INDEX "PersonIdentifier_personId_idx" ON "PersonIdentifier"("personId");

-- CreateIndex
CREATE INDEX "ImportPerson_treeId_idx" ON "ImportPerson"("treeId");

-- CreateIndex
CREATE INDEX "ImportPerson_treeId_gedcomXref_idx" ON "ImportPerson"("treeId", "gedcomXref");

-- CreateIndex
CREATE INDEX "ImportFamily_treeId_idx" ON "ImportFamily"("treeId");

-- CreateIndex
CREATE INDEX "ImportFamily_treeId_gedcomXref_idx" ON "ImportFamily"("treeId", "gedcomXref");

-- CreateIndex
CREATE INDEX "ImportEvent_treeId_idx" ON "ImportEvent"("treeId");

-- CreateIndex
CREATE INDEX "ImportEvent_treeId_gedcomXref_idx" ON "ImportEvent"("treeId", "gedcomXref");

-- CreateIndex
CREATE INDEX "ImportSource_treeId_idx" ON "ImportSource"("treeId");

-- CreateIndex
CREATE INDEX "ImportSource_treeId_gedcomXref_idx" ON "ImportSource"("treeId", "gedcomXref");

-- CreateIndex
CREATE INDEX "GedcomXrefMap_treeId_idx" ON "GedcomXrefMap"("treeId");

-- CreateIndex
CREATE INDEX "GedcomXrefMap_xref_idx" ON "GedcomXrefMap"("xref");

-- CreateIndex
CREATE UNIQUE INDEX "GedcomXrefMap_treeId_xref_entityType_key" ON "GedcomXrefMap"("treeId", "xref", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "DnaMatch_treeId_personId_matchPersonId_provider_key" ON "DnaMatch"("treeId", "personId", "matchPersonId", "provider");

-- DropIndex
DROP INDEX IF EXISTS "Event_treeId_type_sortDate_idx";

-- CreateIndex
CREATE INDEX "Event_treeId_type_sortDate_idx" ON "Event"("treeId", "type", "sortDate");

-- DropIndex
DROP INDEX IF EXISTS "Fact_treeId_type_idx";

-- CreateIndex
CREATE INDEX "Fact_treeId_type_idx" ON "Fact"("treeId", "type");

-- CreateIndex
CREATE INDEX "MediaLink_citationId_idx" ON "MediaLink"("citationId");

-- CreateIndex
CREATE INDEX "NoteLink_placeId_idx" ON "NoteLink"("placeId");

-- CreateIndex
CREATE INDEX "NoteLink_citationId_idx" ON "NoteLink"("citationId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceTranslation" ADD CONSTRAINT "PlaceTranslation_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceIdentifier" ADD CONSTRAINT "PlaceIdentifier_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationText" ADD CONSTRAINT "CitationText_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationIdentifier" ADD CONSTRAINT "CitationIdentifier_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NameValidity" ADD CONSTRAINT "NameValidity_nameId_fkey" FOREIGN KEY ("nameId") REFERENCES "Name"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceIdentifier" ADD CONSTRAINT "SourceIdentifier_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaVariant" ADD CONSTRAINT "MediaVariant_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonIdentifier" ADD CONSTRAINT "PersonIdentifier_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
