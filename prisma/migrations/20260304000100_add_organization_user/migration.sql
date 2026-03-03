-- CreateTable
CREATE TABLE "organization" (
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "user" (
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey (organization self-reference)
ALTER TABLE "organization" ADD CONSTRAINT "organization_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organization"("organization_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (user -> organization)
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert default organization and user for existing data migration
INSERT INTO "organization" ("organization_id", "name", "type", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'HEADQUARTERS', CURRENT_TIMESTAMP);

INSERT INTO "user" ("user_id", "organization_id", "name", "email", "password_hash", "role", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Default User', 'default@example.com', '$2b$10$placeholder', 'ADMIN', CURRENT_TIMESTAMP);

-- AlterTable: Convert reported_by from Int to Text (if not already text)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issue' AND column_name = 'reported_by' AND data_type = 'integer'
  ) THEN
    ALTER TABLE "issue" ALTER COLUMN "reported_by" DROP DEFAULT;
    ALTER TABLE "issue" ALTER COLUMN "reported_by" SET DATA TYPE TEXT USING "reported_by"::TEXT;
  END IF;
END $$;

-- Update existing issues to point to the default user
UPDATE "issue" SET "reported_by" = '00000000-0000-0000-0000-000000000001' WHERE "reported_by" NOT IN (SELECT "user_id" FROM "user");

-- AddForeignKey (issue -> user)
ALTER TABLE "issue" ADD CONSTRAINT "issue_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
