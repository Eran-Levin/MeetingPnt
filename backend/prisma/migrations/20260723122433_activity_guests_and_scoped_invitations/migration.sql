-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "activity_id" TEXT;

-- CreateTable
CREATE TABLE "activity_guests" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_guests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_guests_user_id_idx" ON "activity_guests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_guests_activity_id_user_id_key" ON "activity_guests"("activity_id", "user_id");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_guests" ADD CONSTRAINT "activity_guests_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_guests" ADD CONSTRAINT "activity_guests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_guests" ADD CONSTRAINT "activity_guests_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
