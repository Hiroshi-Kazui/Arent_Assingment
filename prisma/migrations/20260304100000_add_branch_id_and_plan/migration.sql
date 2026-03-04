-- AlterTable
ALTER TABLE "building" ADD COLUMN "branch_id" TEXT;

-- AlterTable
ALTER TABLE "project" ADD COLUMN "plan" TEXT NOT NULL DEFAULT '';
ALTER TABLE "project" ADD COLUMN "branch_id" TEXT;

-- AddForeignKey
ALTER TABLE "building" ADD CONSTRAINT "building_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "organization"("organization_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "organization"("organization_id") ON DELETE SET NULL ON UPDATE CASCADE;
