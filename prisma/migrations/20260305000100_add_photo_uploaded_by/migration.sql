-- AlterTable
ALTER TABLE "photo" ADD COLUMN "uploaded_by" TEXT;

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
