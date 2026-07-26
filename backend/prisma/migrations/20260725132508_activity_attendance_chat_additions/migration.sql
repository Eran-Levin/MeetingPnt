-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent');

-- CreateEnum
CREATE TYPE "GroupChatMode" AS ENUM ('announcements', 'two_way');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "end_at" TIMESTAMP(3),
ADD COLUMN     "requires_rsvp" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "chat_mode" "GroupChatMode" NOT NULL DEFAULT 'two_way';

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "marked_by" TEXT NOT NULL,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_activity_id_idx" ON "attendance"("activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_activity_id_user_id_key" ON "attendance"("activity_id", "user_id");

-- CreateIndex
CREATE INDEX "messages_group_id_created_at_idx" ON "messages"("group_id", "created_at");

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
