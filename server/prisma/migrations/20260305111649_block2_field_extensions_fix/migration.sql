-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "age" TEXT,
ADD COLUMN     "cause" TEXT;

-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "callNumbers" TEXT[];
