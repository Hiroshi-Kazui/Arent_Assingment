-- Backfill existing rows before enforcing NOT NULL.
UPDATE "issue"
SET "due_date" = "created_at"
WHERE "due_date" IS NULL;

-- AlterTable
ALTER TABLE "issue" ALTER COLUMN "due_date" SET NOT NULL;
