-- Allow users to create multiple trees (families) by default.
ALTER TABLE "User" ALTER COLUMN "maxTrees" SET DEFAULT 5;

-- Backfill existing users that still have the old single-tree default.
UPDATE "User" SET "maxTrees" = 5 WHERE "maxTrees" = 1;
