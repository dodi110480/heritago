/*
  Warnings:

  - The `level` column on the `Place` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PlaceLevel" AS ENUM ('BUILDING', 'STREET', 'DISTRICT', 'CITY', 'MUNICIPALITY', 'REGION', 'STATE', 'COUNTRY', 'CONTINENT');

-- AlterTable
ALTER TABLE "Place" DROP COLUMN "level",
ADD COLUMN     "level" "PlaceLevel" NOT NULL DEFAULT 'CITY';
