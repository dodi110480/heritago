-- AlterTable
ALTER TABLE "User" ADD COLUMN     "verificationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "maxTrees" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "isSuspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- Data backfill: existing users predate email verification; keep them active.
UPDATE "User" SET "isEmailVerified" = true WHERE "isEmailVerified" = false;

