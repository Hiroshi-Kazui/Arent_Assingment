-- AlterTable
ALTER TABLE "issue"
  DROP COLUMN "reported_by",
  ADD COLUMN "reported_by" INTEGER NOT NULL DEFAULT 1;
