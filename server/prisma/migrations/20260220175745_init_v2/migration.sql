-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F', 'X', 'U', 'O');

-- CreateEnum
CREATE TYPE "NameType" AS ENUM ('BIRTH', 'MARRIED', 'AKA', 'NICK', 'ROMANIZED', 'OTHER');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BIRT', 'CHR', 'DEAT', 'BURI', 'CREM', 'ADOP', 'BAPM', 'BAR', 'BAS', 'BLES', 'CHRA', 'CONF', 'FCOM', 'NATU', 'EMIG', 'IMMI', 'CENS', 'PROB', 'WILL', 'GRAD', 'RETI', 'OCCU', 'EDUC', 'TITL', 'RESI', 'MARR', 'DIV', 'ANUL', 'MARB', 'MARC', 'MARL', 'MARS', 'EVEN');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('HUSB', 'WIFE', 'PART', 'CHIL', 'ADOP', 'FOST', 'STEP', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tree" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Individual" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "gedcomId" TEXT NOT NULL,
    "sex" "Gender" NOT NULL DEFAULT 'U',
    "private" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Individual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Name" (
    "id" TEXT NOT NULL,
    "individualId" TEXT NOT NULL,
    "type" "NameType" NOT NULL DEFAULT 'BIRTH',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "full" TEXT NOT NULL,
    "given" TEXT,
    "surname" TEXT,
    "prefix" TEXT,
    "suffix" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Name_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "gedcomId" TEXT,
    "type" TEXT,
    "sortDate" TIMESTAMP(3),

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "individualId" TEXT NOT NULL,
    "role" "RoleType" NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "typeCustom" TEXT,
    "dateText" TEXT,
    "dateSortLow" TIMESTAMP(3),
    "dateSortHigh" TIMESTAMP(3),
    "ageAtEvent" TEXT,
    "indiOwnerId" TEXT,
    "famOwnerId" TEXT,
    "placeId" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fact" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dateText" TEXT,
    "dateSortLow" TIMESTAMP(3),
    "indiOwnerId" TEXT,
    "famOwnerId" TEXT,

    CONSTRAINT "Fact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "gedcomName" TEXT NOT NULL,
    "normalized" TEXT,
    "hierarchy" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "gedcomId" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publication" TEXT,
    "repositoryId" TEXT,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "page" TEXT,
    "dateText" TEXT,
    "quotation" TEXT,
    "indiId" TEXT,
    "famId" TEXT,
    "eventId" TEXT,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "gedcomId" TEXT,
    "text" TEXT NOT NULL,
    "private" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteLink" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "individualId" TEXT,
    "familyId" TEXT,
    "eventId" TEXT,
    "sourceId" TEXT,
    "repositoryId" TEXT,

    CONSTRAINT "NoteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaObject" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "gedcomId" TEXT,
    "title" TEXT,
    "filePath" TEXT,
    "url" TEXT,
    "mimeType" TEXT,
    "primaryFor" TEXT,

    CONSTRAINT "MediaObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaLink" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "individualId" TEXT,
    "familyId" TEXT,
    "eventId" TEXT,
    "sourceId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MediaLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "gedcomId" TEXT,
    "name" TEXT NOT NULL,
    "address" JSONB,
    "phone" TEXT,
    "email" TEXT,
    "www" TEXT,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Extension" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "value" JSONB,

    CONSTRAINT "Extension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Tree_name_key" ON "Tree"("name");

-- CreateIndex
CREATE INDEX "Individual_treeId_sex_idx" ON "Individual"("treeId", "sex");

-- CreateIndex
CREATE UNIQUE INDEX "Individual_treeId_gedcomId_key" ON "Individual"("treeId", "gedcomId");

-- CreateIndex
CREATE INDEX "Name_individualId_isPrimary_idx" ON "Name"("individualId", "isPrimary");

-- CreateIndex
CREATE INDEX "Name_surname_given_idx" ON "Name"("surname", "given");

-- CreateIndex
CREATE INDEX "Name_surname_idx" ON "Name"("surname");

-- CreateIndex
CREATE INDEX "Family_treeId_idx" ON "Family"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "Family_treeId_gedcomId_key" ON "Family"("treeId", "gedcomId");

-- CreateIndex
CREATE INDEX "FamilyMember_individualId_idx" ON "FamilyMember"("individualId");

-- CreateIndex
CREATE INDEX "FamilyMember_familyId_idx" ON "FamilyMember"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_familyId_individualId_role_key" ON "FamilyMember"("familyId", "individualId", "role");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Event_dateSortLow_idx" ON "Event"("dateSortLow");

-- CreateIndex
CREATE INDEX "Event_indiOwnerId_idx" ON "Event"("indiOwnerId");

-- CreateIndex
CREATE INDEX "Event_famOwnerId_idx" ON "Event"("famOwnerId");

-- CreateIndex
CREATE INDEX "Fact_type_idx" ON "Fact"("type");

-- CreateIndex
CREATE INDEX "Place_treeId_gedcomName_idx" ON "Place"("treeId", "gedcomName");

-- CreateIndex
CREATE INDEX "Place_normalized_idx" ON "Place"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "Source_treeId_gedcomId_key" ON "Source"("treeId", "gedcomId");

-- CreateIndex
CREATE INDEX "Citation_sourceId_idx" ON "Citation"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Note_treeId_gedcomId_key" ON "Note"("treeId", "gedcomId");

-- CreateIndex
CREATE INDEX "NoteLink_noteId_idx" ON "NoteLink"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaObject_treeId_gedcomId_key" ON "MediaObject"("treeId", "gedcomId");

-- CreateIndex
CREATE INDEX "MediaLink_mediaId_idx" ON "MediaLink"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_treeId_gedcomId_key" ON "Repository"("treeId", "gedcomId");

-- CreateIndex
CREATE INDEX "Extension_ownerType_ownerId_tag_idx" ON "Extension"("ownerType", "ownerId", "tag");

-- AddForeignKey
ALTER TABLE "Individual" ADD CONSTRAINT "Individual_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Name" ADD CONSTRAINT "Name_individualId_fkey" FOREIGN KEY ("individualId") REFERENCES "Individual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_individualId_fkey" FOREIGN KEY ("individualId") REFERENCES "Individual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_indiOwnerId_fkey" FOREIGN KEY ("indiOwnerId") REFERENCES "Individual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_famOwnerId_fkey" FOREIGN KEY ("famOwnerId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_indiOwnerId_fkey" FOREIGN KEY ("indiOwnerId") REFERENCES "Individual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fact" ADD CONSTRAINT "Fact_famOwnerId_fkey" FOREIGN KEY ("famOwnerId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_indiId_fkey" FOREIGN KEY ("indiId") REFERENCES "Individual"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_famId_fkey" FOREIGN KEY ("famId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_individualId_fkey" FOREIGN KEY ("individualId") REFERENCES "Individual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaObject" ADD CONSTRAINT "MediaObject_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_individualId_fkey" FOREIGN KEY ("individualId") REFERENCES "Individual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
