/*
  Warnings:

  - The `type` column on the `Name` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `CitationIdentifier` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PersonIdentifier` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlaceIdentifier` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SourceIdentifier` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "NameType" AS ENUM ('BIRTH', 'MARRIED', 'ALSO_KNOWN_AS', 'IMMIGRANT', 'MAIDEN', 'OTHER');

-- CreateEnum
CREATE TYPE "RestrictionNotice" AS ENUM ('CONFIDENTIAL', 'LOCKED', 'PRIVACY', 'NONE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityType" ADD VALUE 'SUBMITTER';
ALTER TYPE "EntityType" ADD VALUE 'CITATION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'BAPL';
ALTER TYPE "EventType" ADD VALUE 'ENDO';
ALTER TYPE "EventType" ADD VALUE 'SLGC';
ALTER TYPE "EventType" ADD VALUE 'SLGS';

-- DropForeignKey
ALTER TABLE "CitationIdentifier" DROP CONSTRAINT "CitationIdentifier_citationId_fkey";

-- DropForeignKey
ALTER TABLE "PersonIdentifier" DROP CONSTRAINT "PersonIdentifier_personId_fkey";

-- DropForeignKey
ALTER TABLE "PlaceIdentifier" DROP CONSTRAINT "PlaceIdentifier_placeId_fkey";

-- DropForeignKey
ALTER TABLE "SourceIdentifier" DROP CONSTRAINT "SourceIdentifier_sourceId_fkey";

-- DropIndex
DROP INDEX "MediaLink_familyId_idx";

-- DropIndex
DROP INDEX "MediaLink_mediaId_idx";

-- DropIndex
DROP INDEX "MediaLink_personId_idx";

-- DropIndex
DROP INDEX "MediaLink_treeId_idx";

-- AlterTable
ALTER TABLE "Association" ADD COLUMN     "rolePhrase" TEXT;

-- AlterTable
ALTER TABLE "Citation" ADD COLUMN     "extensions" JSONB,
ADD COLUMN     "maxDate" TIMESTAMP(3),
ADD COLUMN     "minDate" TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "customType" TEXT,
ADD COLUMN     "extensions" JSONB,
ADD COLUMN     "importId" TEXT,
ADD COLUMN     "ldsFamcId" TEXT,
ADD COLUMN     "ldsStatus" TEXT,
ADD COLUMN     "ldsTemple" TEXT,
ADD COLUMN     "maxDate" TIMESTAMP(3),
ADD COLUMN     "minDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Fact" ADD COLUMN     "customType" TEXT,
ADD COLUMN     "extensions" JSONB,
ADD COLUMN     "maxDate" TIMESTAMP(3),
ADD COLUMN     "minDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "extensions" JSONB,
ADD COLUMN     "importId" TEXT,
ADD COLUMN     "restrictionNotice" "RestrictionNotice" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "ImportEvent" ADD COLUMN     "importId" TEXT;

-- AlterTable
ALTER TABLE "ImportFamily" ADD COLUMN     "importId" TEXT;

-- AlterTable
ALTER TABLE "ImportPerson" ADD COLUMN     "importId" TEXT;

-- AlterTable
ALTER TABLE "ImportSource" ADD COLUMN     "importId" TEXT;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "extensions" JSONB,
ADD COLUMN     "importId" TEXT;

-- AlterTable
ALTER TABLE "MediaLink" ADD COLUMN     "headerTreeId" TEXT,
ADD COLUMN     "noteId" TEXT,
ADD COLUMN     "submitterId" TEXT;

-- AlterTable
ALTER TABLE "Name" DROP COLUMN "type",
ADD COLUMN     "type" "NameType";

-- AlterTable
ALTER TABLE "NameValidity" ADD COLUMN     "maxDate" TIMESTAMP(3),
ADD COLUMN     "minDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NoteLink" ADD COLUMN     "submitterId" TEXT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "extensions" JSONB,
ADD COLUMN     "importId" TEXT,
ADD COLUMN     "restrictionNotice" "RestrictionNotice" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "extensions" JSONB,
ADD COLUMN     "importId" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "extensions" JSONB,
ADD COLUMN     "importId" TEXT;

-- AlterTable
ALTER TABLE "SharedNote" ADD COLUMN     "extensions" JSONB,
ADD COLUMN     "importId" TEXT,
ADD COLUMN     "lines" TEXT[],
ADD COLUMN     "mime" TEXT;

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "extensions" JSONB,
ADD COLUMN     "importId" TEXT;

-- AlterTable
ALTER TABLE "Tree" ADD COLUMN     "copyright" TEXT,
ADD COLUMN     "destination" TEXT,
ADD COLUMN     "exportDate" TIMESTAMP(3),
ADD COLUMN     "extensions" JSONB,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "gedcomVersion" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "placForm" TEXT,
ADD COLUMN     "schemaExtensions" JSONB,
ADD COLUMN     "sourceData" TEXT,
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "sourceSoftware" TEXT,
ADD COLUMN     "sourceVers" TEXT;

-- DropTable
DROP TABLE "CitationIdentifier";

-- DropTable
DROP TABLE "PersonIdentifier";

-- DropTable
DROP TABLE "PlaceIdentifier";

-- DropTable
DROP TABLE "SourceIdentifier";

-- CreateTable
CREATE TABLE "Identifier" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT,
    "personId" TEXT,
    "placeId" TEXT,
    "sourceId" TEXT,
    "citationId" TEXT,
    "familyId" TEXT,
    "mediaId" TEXT,
    "repositoryId" TEXT,
    "submitterId" TEXT,

    CONSTRAINT "Identifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submitter" (
    "id" TEXT NOT NULL,
    "gedcomId" TEXT,
    "treeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addrStreet" TEXT,
    "addrCity" TEXT,
    "addrState" TEXT,
    "addrPostal" TEXT,
    "addrCountry" TEXT,
    "phone" TEXT[],
    "email" TEXT[],
    "fax" TEXT[],
    "www" TEXT[],
    "language" TEXT,
    "chanDate" TIMESTAMP(3),
    "extensions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submitter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "source" TEXT,
    "personCount" INTEGER,
    "familyCount" INTEGER,
    "eventCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportSubmitter" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "importId" TEXT,
    "gedcomXref" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportSubmitter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRepository" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "importId" TEXT,
    "gedcomXref" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportMedia" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "importId" TEXT,
    "gedcomXref" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportSharedNote" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "importId" TEXT,
    "gedcomXref" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportSharedNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Identifier_treeId_idx" ON "Identifier"("treeId");

-- CreateIndex
CREATE INDEX "Identifier_entityId_idx" ON "Identifier"("entityId");

-- CreateIndex
CREATE INDEX "Identifier_value_idx" ON "Identifier"("value");

-- CreateIndex
CREATE INDEX "Submitter_treeId_idx" ON "Submitter"("treeId");

-- CreateIndex
CREATE INDEX "Submitter_gedcomId_idx" ON "Submitter"("gedcomId");

-- CreateIndex
CREATE INDEX "Import_treeId_idx" ON "Import"("treeId");

-- CreateIndex
CREATE INDEX "ImportSubmitter_treeId_idx" ON "ImportSubmitter"("treeId");

-- CreateIndex
CREATE INDEX "ImportSubmitter_importId_idx" ON "ImportSubmitter"("importId");

-- CreateIndex
CREATE INDEX "ImportSubmitter_treeId_gedcomXref_idx" ON "ImportSubmitter"("treeId", "gedcomXref");

-- CreateIndex
CREATE INDEX "ImportRepository_treeId_idx" ON "ImportRepository"("treeId");

-- CreateIndex
CREATE INDEX "ImportRepository_importId_idx" ON "ImportRepository"("importId");

-- CreateIndex
CREATE INDEX "ImportRepository_treeId_gedcomXref_idx" ON "ImportRepository"("treeId", "gedcomXref");

-- CreateIndex
CREATE INDEX "ImportMedia_treeId_idx" ON "ImportMedia"("treeId");

-- CreateIndex
CREATE INDEX "ImportMedia_importId_idx" ON "ImportMedia"("importId");

-- CreateIndex
CREATE INDEX "ImportMedia_treeId_gedcomXref_idx" ON "ImportMedia"("treeId", "gedcomXref");

-- CreateIndex
CREATE INDEX "ImportSharedNote_treeId_idx" ON "ImportSharedNote"("treeId");

-- CreateIndex
CREATE INDEX "ImportSharedNote_importId_idx" ON "ImportSharedNote"("importId");

-- CreateIndex
CREATE INDEX "ImportSharedNote_treeId_gedcomXref_idx" ON "ImportSharedNote"("treeId", "gedcomXref");

-- CreateIndex
CREATE INDEX "Event_importId_idx" ON "Event"("importId");

-- CreateIndex
CREATE INDEX "Family_importId_idx" ON "Family"("importId");

-- CreateIndex
CREATE INDEX "Family_gedcomId_idx" ON "Family"("gedcomId");

-- CreateIndex
CREATE INDEX "ImportEvent_importId_idx" ON "ImportEvent"("importId");

-- CreateIndex
CREATE INDEX "ImportFamily_importId_idx" ON "ImportFamily"("importId");

-- CreateIndex
CREATE INDEX "ImportPerson_importId_idx" ON "ImportPerson"("importId");

-- CreateIndex
CREATE INDEX "ImportSource_importId_idx" ON "ImportSource"("importId");

-- CreateIndex
CREATE INDEX "Media_importId_idx" ON "Media"("importId");

-- CreateIndex
CREATE INDEX "Media_gedcomId_idx" ON "Media"("gedcomId");

-- CreateIndex
CREATE INDEX "MediaLink_noteId_idx" ON "MediaLink"("noteId");

-- CreateIndex
CREATE INDEX "MediaLink_submitterId_idx" ON "MediaLink"("submitterId");

-- CreateIndex
CREATE INDEX "MediaLink_headerTreeId_idx" ON "MediaLink"("headerTreeId");

-- CreateIndex
CREATE INDEX "NoteLink_submitterId_idx" ON "NoteLink"("submitterId");

-- CreateIndex
CREATE INDEX "Person_importId_idx" ON "Person"("importId");

-- CreateIndex
CREATE INDEX "Person_gedcomId_idx" ON "Person"("gedcomId");

-- CreateIndex
CREATE INDEX "Place_importId_idx" ON "Place"("importId");

-- CreateIndex
CREATE INDEX "Repository_importId_idx" ON "Repository"("importId");

-- CreateIndex
CREATE INDEX "Repository_gedcomId_idx" ON "Repository"("gedcomId");

-- CreateIndex
CREATE INDEX "SharedNote_importId_idx" ON "SharedNote"("importId");

-- CreateIndex
CREATE INDEX "SharedNote_gedcomId_idx" ON "SharedNote"("gedcomId");

-- CreateIndex
CREATE INDEX "Source_importId_idx" ON "Source"("importId");

-- CreateIndex
CREATE INDEX "Source_gedcomId_idx" ON "Source"("gedcomId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_ldsFamcId_fkey" FOREIGN KEY ("ldsFamcId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identifier" ADD CONSTRAINT "Identifier_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identifier" ADD CONSTRAINT "Identifier_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identifier" ADD CONSTRAINT "Identifier_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identifier" ADD CONSTRAINT "Identifier_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identifier" ADD CONSTRAINT "Identifier_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identifier" ADD CONSTRAINT "Identifier_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identifier" ADD CONSTRAINT "Identifier_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identifier" ADD CONSTRAINT "Identifier_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identifier" ADD CONSTRAINT "Identifier_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "Submitter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedNote" ADD CONSTRAINT "SharedNote_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "Submitter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_headerTreeId_fkey" FOREIGN KEY ("headerTreeId") REFERENCES "Tree"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "SharedNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "Submitter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submitter" ADD CONSTRAINT "Submitter_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportPerson" ADD CONSTRAINT "ImportPerson_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportFamily" ADD CONSTRAINT "ImportFamily_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportEvent" ADD CONSTRAINT "ImportEvent_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSource" ADD CONSTRAINT "ImportSource_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSubmitter" ADD CONSTRAINT "ImportSubmitter_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRepository" ADD CONSTRAINT "ImportRepository_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportMedia" ADD CONSTRAINT "ImportMedia_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSharedNote" ADD CONSTRAINT "ImportSharedNote_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE CASCADE ON UPDATE CASCADE;
