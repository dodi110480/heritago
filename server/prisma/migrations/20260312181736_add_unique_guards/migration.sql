/*
  Warnings:

  - A unique constraint covering the columns `[treeId,personId,familyId,associatedPersonId,role,eventId,factId]` on the table `Association` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[personId,familyId,type,dateText,placeId,description]` on the table `Event` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[personId,familyId,type,value,dateText,placeId]` on the table `Fact` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[personId,full,type,isPrimary]` on the table `Name` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "AssociationRole" ADD VALUE 'INFORMANT';

-- DropIndex
DROP INDEX "Association_treeId_personId_associatedPersonId_role_key";

-- AlterTable
ALTER TABLE "Association" ADD COLUMN     "factId" TEXT,
ADD COLUMN     "familyId" TEXT,
ALTER COLUMN "personId" DROP NOT NULL,
ALTER COLUMN "associatedPersonId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SharedNote" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "category" TEXT,
ADD COLUMN     "sourceType" TEXT;

-- CreateIndex
CREATE INDEX "Association_factId_idx" ON "Association"("factId");

-- CreateIndex
CREATE UNIQUE INDEX "Association_treeId_personId_familyId_associatedPersonId_rol_key" ON "Association"("treeId", "personId", "familyId", "associatedPersonId", "role", "eventId", "factId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_personId_familyId_type_dateText_placeId_description_key" ON "Event"("personId", "familyId", "type", "dateText", "placeId", "description");

-- CreateIndex
CREATE UNIQUE INDEX "Fact_personId_familyId_type_value_dateText_placeId_key" ON "Fact"("personId", "familyId", "type", "value", "dateText", "placeId");

-- CreateIndex
CREATE UNIQUE INDEX "Name_personId_full_type_isPrimary_key" ON "Name"("personId", "full", "type", "isPrimary");

-- AddForeignKey
ALTER TABLE "SharedNote" ADD CONSTRAINT "SharedNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Association" ADD CONSTRAINT "Association_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Association" ADD CONSTRAINT "Association_factId_fkey" FOREIGN KEY ("factId") REFERENCES "Fact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
