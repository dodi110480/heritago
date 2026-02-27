/*
  Warnings:

  - You are about to drop the column `famId` on the `Citation` table. All the data in the column will be lost.
  - You are about to drop the column `indiId` on the `Citation` table. All the data in the column will be lost.
  - You are about to drop the column `quotation` on the `Citation` table. All the data in the column will be lost.
  - You are about to drop the column `ageAtEvent` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `dateSortHigh` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `dateSortLow` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `famOwnerId` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `indiOwnerId` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `typeCustom` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `dateSortLow` on the `Fact` table. All the data in the column will be lost.
  - You are about to drop the column `famOwnerId` on the `Fact` table. All the data in the column will be lost.
  - You are about to drop the column `indiOwnerId` on the `Fact` table. All the data in the column will be lost.
  - You are about to drop the column `sortDate` on the `Family` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Family` table. All the data in the column will be lost.
  - You are about to drop the column `individualId` on the `FamilyMember` table. All the data in the column will be lost.
  - The `role` column on the `FamilyMember` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `individualId` on the `MediaLink` table. All the data in the column will be lost.
  - You are about to drop the column `individualId` on the `Name` table. All the data in the column will be lost.
  - The `type` column on the `Name` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `individualId` on the `NoteLink` table. All the data in the column will be lost.
  - You are about to drop the column `repositoryId` on the `NoteLink` table. All the data in the column will be lost.
  - You are about to drop the column `gedcomName` on the `Place` table. All the data in the column will be lost.
  - You are about to drop the column `hierarchy` on the `Place` table. All the data in the column will be lost.
  - You are about to drop the column `normalized` on the `Place` table. All the data in the column will be lost.
  - You are about to drop the column `www` on the `Repository` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `Tree` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `Extension` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Individual` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MediaObject` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Note` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[familyId,personId]` on the table `FamilyMember` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[treeId,name,parentId]` on the table `Place` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `treeId` to the `Citation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `treeId` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Event` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `treeId` to the `Fact` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Family` table without a default value. This is not possible if the table is not empty.
  - Added the required column `personId` to the `FamilyMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `treeId` to the `MediaLink` table without a default value. This is not possible if the table is not empty.
  - Added the required column `personId` to the `Name` table without a default value. This is not possible if the table is not empty.
  - Added the required column `treeId` to the `Name` table without a default value. This is not possible if the table is not empty.
  - Added the required column `treeId` to the `NoteLink` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Place` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Repository` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Source` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('ADMIN', 'USER', 'GUEST');

-- CreateEnum
CREATE TYPE "TreeAccessLevel" AS ENUM ('OWNER', 'EDITOR', 'VIEWER', 'COMMENTER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('M', 'F', 'X', 'U');

-- CreateEnum
CREATE TYPE "PrivacyLevel" AS ENUM ('PUBLIC', 'FAMILY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('SPOUSE', 'CHILD', 'PARENT');

-- CreateEnum
CREATE TYPE "MarriageType" AS ENUM ('CIVIL', 'RELIGIOUS', 'COMMON_LAW', 'SAME_SEX', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PedigreeType" AS ENUM ('BIRTH', 'ADOPTED', 'FOSTER', 'STEP', 'SEALED');

-- CreateEnum
CREATE TYPE "DatePrecision" AS ENUM ('EXACT', 'ABOUT', 'CALCULATED', 'BEFORE', 'AFTER', 'BETWEEN', 'RANGE');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('CERTAIN', 'VERY_LIKELY', 'LIKELY', 'POSSIBLE', 'UNLIKELY');

-- CreateEnum
CREATE TYPE "ResearchStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ChangeAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "DnaTestProvider" AS ENUM ('ANCESTRY', 'MYHERITAGE', 'GEDMATCH', 'TWENTY_THREE_AND_ME', 'FAMILY_TREE_DNA', 'LIVING_DNA');

-- CreateEnum
CREATE TYPE "AssociationRole" AS ENUM ('GODPARENT', 'WITNESS', 'CLERGY', 'EMPLOYER', 'FRIEND', 'OTHER');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PERSON', 'FAMILY', 'EVENT', 'FACT', 'SOURCE', 'REPOSITORY', 'MEDIA', 'NOTE', 'PLACE', 'OTHER');

-- DropForeignKey
ALTER TABLE "Citation" DROP CONSTRAINT "Citation_famId_fkey";

-- DropForeignKey
ALTER TABLE "Citation" DROP CONSTRAINT "Citation_indiId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_famOwnerId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_indiOwnerId_fkey";

-- DropForeignKey
ALTER TABLE "Fact" DROP CONSTRAINT "Fact_famOwnerId_fkey";

-- DropForeignKey
ALTER TABLE "Fact" DROP CONSTRAINT "Fact_indiOwnerId_fkey";

-- DropForeignKey
ALTER TABLE "FamilyMember" DROP CONSTRAINT "FamilyMember_individualId_fkey";

-- DropForeignKey
ALTER TABLE "Individual" DROP CONSTRAINT "Individual_treeId_fkey";

-- DropForeignKey
ALTER TABLE "MediaLink" DROP CONSTRAINT "MediaLink_eventId_fkey";

-- DropForeignKey
ALTER TABLE "MediaLink" DROP CONSTRAINT "MediaLink_familyId_fkey";

-- DropForeignKey
ALTER TABLE "MediaLink" DROP CONSTRAINT "MediaLink_individualId_fkey";

-- DropForeignKey
ALTER TABLE "MediaLink" DROP CONSTRAINT "MediaLink_mediaId_fkey";

-- DropForeignKey
ALTER TABLE "MediaLink" DROP CONSTRAINT "MediaLink_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "MediaObject" DROP CONSTRAINT "MediaObject_treeId_fkey";

-- DropForeignKey
ALTER TABLE "Name" DROP CONSTRAINT "Name_individualId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_treeId_fkey";

-- DropForeignKey
ALTER TABLE "NoteLink" DROP CONSTRAINT "NoteLink_eventId_fkey";

-- DropForeignKey
ALTER TABLE "NoteLink" DROP CONSTRAINT "NoteLink_familyId_fkey";

-- DropForeignKey
ALTER TABLE "NoteLink" DROP CONSTRAINT "NoteLink_individualId_fkey";

-- DropForeignKey
ALTER TABLE "NoteLink" DROP CONSTRAINT "NoteLink_noteId_fkey";

-- DropForeignKey
ALTER TABLE "NoteLink" DROP CONSTRAINT "NoteLink_repositoryId_fkey";

-- DropForeignKey
ALTER TABLE "NoteLink" DROP CONSTRAINT "NoteLink_sourceId_fkey";

-- DropIndex
DROP INDEX "Event_dateSortLow_idx";

-- DropIndex
DROP INDEX "Event_famOwnerId_idx";

-- DropIndex
DROP INDEX "Event_indiOwnerId_idx";

-- DropIndex
DROP INDEX "Event_type_idx";

-- DropIndex
DROP INDEX "Fact_type_idx";

-- DropIndex
DROP INDEX "FamilyMember_familyId_individualId_role_key";

-- DropIndex
DROP INDEX "FamilyMember_individualId_idx";

-- DropIndex
DROP INDEX "Name_individualId_isPrimary_idx";

-- DropIndex
DROP INDEX "Name_surname_given_idx";

-- DropIndex
DROP INDEX "Name_surname_idx";

-- DropIndex
DROP INDEX "Place_normalized_idx";

-- DropIndex
DROP INDEX "Place_treeId_gedcomName_idx";

-- DropIndex
DROP INDEX "Repository_treeId_gedcomId_key";

-- AlterTable
ALTER TABLE "Citation" DROP COLUMN "famId",
DROP COLUMN "indiId",
DROP COLUMN "quotation",
ADD COLUMN     "associationId" TEXT,
ADD COLUMN     "confidence" "ConfidenceLevel",
ADD COLUMN     "factId" TEXT,
ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "mediaId" TEXT,
ADD COLUMN     "noteId" TEXT,
ADD COLUMN     "personId" TEXT,
ADD COLUMN     "treeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "ageAtEvent",
DROP COLUMN "dateSortHigh",
DROP COLUMN "dateSortLow",
DROP COLUMN "famOwnerId",
DROP COLUMN "indiOwnerId",
DROP COLUMN "typeCustom",
ADD COLUMN     "dateEnd" TIMESTAMP(3),
ADD COLUMN     "dateStart" TIMESTAMP(3),
ADD COLUMN     "dateType" "DatePrecision",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "isNegative" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "personId" TEXT,
ADD COLUMN     "sortDate" TIMESTAMP(3),
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "treeId" TEXT NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Fact" DROP COLUMN "dateSortLow",
DROP COLUMN "famOwnerId",
DROP COLUMN "indiOwnerId",
ADD COLUMN     "dateEnd" TIMESTAMP(3),
ADD COLUMN     "dateStart" TIMESTAMP(3),
ADD COLUMN     "dateType" "DatePrecision",
ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "personId" TEXT,
ADD COLUMN     "placeId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "treeId" TEXT NOT NULL,
ALTER COLUMN "value" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Family" DROP COLUMN "sortDate",
DROP COLUMN "type",
ADD COLUMN     "chanDate" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "FamilyMember" DROP COLUMN "individualId",
ADD COLUMN     "marriageType" "MarriageType",
ADD COLUMN     "pedigreeType" "PedigreeType",
ADD COLUMN     "personId" TEXT NOT NULL,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "role",
ADD COLUMN     "role" "FamilyRole";

-- AlterTable
ALTER TABLE "MediaLink" DROP COLUMN "individualId",
ADD COLUMN     "caption" TEXT,
ADD COLUMN     "personId" TEXT,
ADD COLUMN     "role" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "treeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Name" DROP COLUMN "individualId",
ADD COLUMN     "personId" TEXT NOT NULL,
ADD COLUMN     "treeId" TEXT NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT,
ALTER COLUMN "isPrimary" SET DEFAULT true;

-- AlterTable
ALTER TABLE "NoteLink" DROP COLUMN "individualId",
DROP COLUMN "repositoryId",
ADD COLUMN     "context" TEXT,
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mediaId" TEXT,
ADD COLUMN     "personId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "treeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Place" DROP COLUMN "gedcomName",
DROP COLUMN "hierarchy",
DROP COLUMN "normalized",
ADD COLUMN     "historicNames" TEXT[],
ADD COLUMN     "jurisdiction" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "Repository" DROP COLUMN "www",
ADD COLUMN     "chanDate" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "website" TEXT,
ALTER COLUMN "address" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "chanDate" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "shortTitle" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Tree" DROP COLUMN "ownerId",
ADD COLUMN     "chanDate" TIMESTAMP(3),
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "password" DROP NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- DropTable
DROP TABLE "Extension";

-- DropTable
DROP TABLE "Individual";

-- DropTable
DROP TABLE "MediaObject";

-- DropTable
DROP TABLE "Note";

-- DropEnum
DROP TYPE "EventType";

-- DropEnum
DROP TYPE "Gender";

-- DropEnum
DROP TYPE "NameType";

-- DropEnum
DROP TYPE "RoleType";

-- CreateTable
CREATE TABLE "TreePermission" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "TreeAccessLevel" NOT NULL,
    "privacyOverride" BOOLEAN,

    CONSTRAINT "TreePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "gedcomId" TEXT,
    "sex" "Sex",
    "isLiving" BOOLEAN NOT NULL DEFAULT false,
    "privacyLevel" "PrivacyLevel" NOT NULL DEFAULT 'PRIVATE',
    "exid" TEXT,
    "treeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chanDate" TIMESTAMP(3),

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "gedcomId" TEXT,
    "treeId" TEXT NOT NULL,
    "title" TEXT,
    "filePath" TEXT,
    "remoteUrl" TEXT,
    "mimeType" TEXT,
    "mediaType" TEXT,
    "fileSize" INTEGER,
    "dimensions" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chanDate" TIMESTAMP(3),

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedNote" (
    "id" TEXT NOT NULL,
    "gedcomId" TEXT,
    "treeId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "noteType" TEXT,
    "privacyLevel" "PrivacyLevel" NOT NULL DEFAULT 'PRIVATE',
    "researchStatus" "ResearchStatus" NOT NULL DEFAULT 'OPEN',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chanDate" TIMESTAMP(3),

    CONSTRAINT "SharedNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Association" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "associatedPersonId" TEXT NOT NULL,
    "role" "AssociationRole" NOT NULL DEFAULT 'OTHER',
    "relationText" TEXT,
    "dateText" TEXT,
    "confidence" "ConfidenceLevel",
    "notes" TEXT,
    "eventId" TEXT,
    "placeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Association_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DnaMatch" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "matchPersonId" TEXT,
    "provider" "DnaTestProvider",
    "totalCm" DOUBLE PRECISION,
    "largestSegmentCm" DOUBLE PRECISION,
    "segmentCount" INTEGER,
    "predictedRelationship" TEXT,
    "confidence" "ConfidenceLevel",
    "testDate" TIMESTAMP(3),
    "kitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnaMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DnaSegment" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "matchId" TEXT,
    "chromosome" TEXT NOT NULL,
    "startPosition" INTEGER NOT NULL,
    "endPosition" INTEGER NOT NULL,
    "cm" DOUBLE PRECISION NOT NULL,
    "snpCount" INTEGER,
    "provider" "DnaTestProvider",
    "build" TEXT,
    "isTriangulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnaSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchLog" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "userId" TEXT,
    "status" "ResearchStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objective" TEXT,
    "result" TEXT,
    "nextStep" TEXT,
    "entityType" "EntityType",
    "entityId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "ChangeAction" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "summary" TEXT,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreePermission_treeId_idx" ON "TreePermission"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "TreePermission_treeId_userId_key" ON "TreePermission"("treeId", "userId");

-- CreateIndex
CREATE INDEX "Person_treeId_idx" ON "Person"("treeId");

-- CreateIndex
CREATE INDEX "Person_treeId_isLiving_idx" ON "Person"("treeId", "isLiving");

-- CreateIndex
CREATE INDEX "Person_sex_idx" ON "Person"("sex");

-- CreateIndex
CREATE UNIQUE INDEX "Person_treeId_gedcomId_key" ON "Person"("treeId", "gedcomId");

-- CreateIndex
CREATE INDEX "Media_treeId_idx" ON "Media"("treeId");

-- CreateIndex
CREATE INDEX "SharedNote_treeId_idx" ON "SharedNote"("treeId");

-- CreateIndex
CREATE INDEX "SharedNote_treeId_researchStatus_idx" ON "SharedNote"("treeId", "researchStatus");

-- CreateIndex
CREATE INDEX "SharedNote_treeId_noteType_idx" ON "SharedNote"("treeId", "noteType");

-- CreateIndex
CREATE INDEX "Association_treeId_idx" ON "Association"("treeId");

-- CreateIndex
CREATE INDEX "Association_personId_idx" ON "Association"("personId");

-- CreateIndex
CREATE INDEX "Association_associatedPersonId_idx" ON "Association"("associatedPersonId");

-- CreateIndex
CREATE INDEX "Association_eventId_idx" ON "Association"("eventId");

-- CreateIndex
CREATE INDEX "Association_placeId_idx" ON "Association"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "Association_treeId_personId_associatedPersonId_role_key" ON "Association"("treeId", "personId", "associatedPersonId", "role");

-- CreateIndex
CREATE INDEX "DnaMatch_treeId_idx" ON "DnaMatch"("treeId");

-- CreateIndex
CREATE INDEX "DnaMatch_personId_idx" ON "DnaMatch"("personId");

-- CreateIndex
CREATE INDEX "DnaMatch_matchPersonId_idx" ON "DnaMatch"("matchPersonId");

-- CreateIndex
CREATE INDEX "DnaMatch_treeId_provider_idx" ON "DnaMatch"("treeId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "DnaMatch_personId_matchPersonId_provider_key" ON "DnaMatch"("personId", "matchPersonId", "provider");

-- CreateIndex
CREATE INDEX "DnaSegment_treeId_chromosome_idx" ON "DnaSegment"("treeId", "chromosome");

-- CreateIndex
CREATE INDEX "DnaSegment_personId_idx" ON "DnaSegment"("personId");

-- CreateIndex
CREATE INDEX "DnaSegment_matchId_idx" ON "DnaSegment"("matchId");

-- CreateIndex
CREATE INDEX "ResearchLog_treeId_idx" ON "ResearchLog"("treeId");

-- CreateIndex
CREATE INDEX "ResearchLog_userId_idx" ON "ResearchLog"("userId");

-- CreateIndex
CREATE INDEX "ResearchLog_entityType_entityId_idx" ON "ResearchLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ChangeLog_treeId_createdAt_idx" ON "ChangeLog"("treeId", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeLog_treeId_action_idx" ON "ChangeLog"("treeId", "action");

-- CreateIndex
CREATE INDEX "ChangeLog_action_idx" ON "ChangeLog"("action");

-- CreateIndex
CREATE INDEX "ChangeLog_entityType_entityId_idx" ON "ChangeLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ChangeLog_userId_idx" ON "ChangeLog"("userId");

-- CreateIndex
CREATE INDEX "Citation_treeId_idx" ON "Citation"("treeId");

-- CreateIndex
CREATE INDEX "Citation_personId_idx" ON "Citation"("personId");

-- CreateIndex
CREATE INDEX "Citation_familyId_idx" ON "Citation"("familyId");

-- CreateIndex
CREATE INDEX "Citation_eventId_idx" ON "Citation"("eventId");

-- CreateIndex
CREATE INDEX "Citation_factId_idx" ON "Citation"("factId");

-- CreateIndex
CREATE INDEX "Citation_mediaId_idx" ON "Citation"("mediaId");

-- CreateIndex
CREATE INDEX "Citation_noteId_idx" ON "Citation"("noteId");

-- CreateIndex
CREATE INDEX "Citation_associationId_idx" ON "Citation"("associationId");

-- CreateIndex
CREATE INDEX "Event_treeId_idx" ON "Event"("treeId");

-- CreateIndex
CREATE INDEX "Event_treeId_sortDate_idx" ON "Event"("treeId", "sortDate");

-- CreateIndex
CREATE INDEX "Event_treeId_type_sortDate_idx" ON "Event"("treeId", "type", "sortDate");

-- CreateIndex
CREATE INDEX "Fact_treeId_idx" ON "Fact"("treeId");

-- CreateIndex
CREATE INDEX "Fact_treeId_type_idx" ON "Fact"("treeId", "type");

-- CreateIndex
CREATE INDEX "FamilyMember_personId_idx" ON "FamilyMember"("personId");

-- CreateIndex
CREATE INDEX "FamilyMember_familyId_role_idx" ON "FamilyMember"("familyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_familyId_personId_key" ON "FamilyMember"("familyId", "personId");

-- CreateIndex
CREATE INDEX "MediaLink_treeId_idx" ON "MediaLink"("treeId");

-- CreateIndex
CREATE INDEX "MediaLink_personId_idx" ON "MediaLink"("personId");

-- CreateIndex
CREATE INDEX "MediaLink_familyId_idx" ON "MediaLink"("familyId");

-- CreateIndex
CREATE INDEX "MediaLink_eventId_idx" ON "MediaLink"("eventId");

-- CreateIndex
CREATE INDEX "MediaLink_sourceId_idx" ON "MediaLink"("sourceId");

-- CreateIndex
CREATE INDEX "Name_treeId_idx" ON "Name"("treeId");

-- CreateIndex
CREATE INDEX "Name_treeId_surname_given_idx" ON "Name"("treeId", "surname", "given");

-- CreateIndex
CREATE INDEX "Name_treeId_isPrimary_idx" ON "Name"("treeId", "isPrimary");

-- CreateIndex
CREATE INDEX "NoteLink_treeId_idx" ON "NoteLink"("treeId");

-- CreateIndex
CREATE INDEX "NoteLink_personId_idx" ON "NoteLink"("personId");

-- CreateIndex
CREATE INDEX "NoteLink_familyId_idx" ON "NoteLink"("familyId");

-- CreateIndex
CREATE INDEX "NoteLink_eventId_idx" ON "NoteLink"("eventId");

-- CreateIndex
CREATE INDEX "NoteLink_sourceId_idx" ON "NoteLink"("sourceId");

-- CreateIndex
CREATE INDEX "NoteLink_mediaId_idx" ON "NoteLink"("mediaId");

-- CreateIndex
CREATE INDEX "Place_treeId_idx" ON "Place"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "Place_treeId_name_parentId_key" ON "Place"("treeId", "name", "parentId");

-- CreateIndex
CREATE INDEX "Repository_treeId_idx" ON "Repository"("treeId");

-- CreateIndex
CREATE INDEX "Source_treeId_idx" ON "Source"("treeId");

-- CreateIndex
CREATE INDEX "Tree_isPublic_idx" ON "Tree"("isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "TreePermission" ADD CONSTRAINT "TreePermission_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreePermission" ADD CONSTRAINT "TreePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Name" ADD CONSTRAINT "Name_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Name" ADD CONSTRAINT "Name_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_factId_fkey" FOREIGN KEY ("factId") REFERENCES "Fact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "SharedNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedNote" ADD CONSTRAINT "SharedNote_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "SharedNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Association" ADD CONSTRAINT "Association_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Association" ADD CONSTRAINT "Association_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Association" ADD CONSTRAINT "Association_associatedPersonId_fkey" FOREIGN KEY ("associatedPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Association" ADD CONSTRAINT "Association_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Association" ADD CONSTRAINT "Association_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnaMatch" ADD CONSTRAINT "DnaMatch_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnaMatch" ADD CONSTRAINT "DnaMatch_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnaMatch" ADD CONSTRAINT "DnaMatch_matchPersonId_fkey" FOREIGN KEY ("matchPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnaSegment" ADD CONSTRAINT "DnaSegment_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnaSegment" ADD CONSTRAINT "DnaSegment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnaSegment" ADD CONSTRAINT "DnaSegment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "DnaMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchLog" ADD CONSTRAINT "ResearchLog_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchLog" ADD CONSTRAINT "ResearchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
