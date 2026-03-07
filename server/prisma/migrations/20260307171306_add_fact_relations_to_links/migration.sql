-- AlterTable
ALTER TABLE "MediaLink" ADD COLUMN     "factId" TEXT;

-- AlterTable
ALTER TABLE "NoteLink" ADD COLUMN     "factId" TEXT;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_factId_fkey" FOREIGN KEY ("factId") REFERENCES "Fact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_factId_fkey" FOREIGN KEY ("factId") REFERENCES "Fact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
