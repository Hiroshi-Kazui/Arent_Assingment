-- AlterTable
ALTER TABLE "issue" ADD COLUMN     "assignee_id" TEXT;

-- CreateTable
CREATE TABLE "status_change_log" (
    "log_id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "from_status" TEXT NOT NULL,
    "to_status" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "comment" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_change_log_pkey" PRIMARY KEY ("log_id")
);

-- AddForeignKey
ALTER TABLE "issue" ADD CONSTRAINT "issue_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_change_log" ADD CONSTRAINT "status_change_log_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issue"("issue_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_change_log" ADD CONSTRAINT "status_change_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
