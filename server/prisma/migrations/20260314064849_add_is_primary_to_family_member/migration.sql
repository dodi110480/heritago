-- AlterTable
ALTER TABLE "FamilyMember" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "MediaLink_personId_idx" ON "MediaLink"("personId");

-- CreateIndex
CREATE INDEX "MediaLink_familyId_idx" ON "MediaLink"("familyId");

-- CreateIndex
CREATE INDEX "Place_treeId_name_idx" ON "Place"("treeId", "name");
