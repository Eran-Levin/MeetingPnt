-- Rescope attendance from the activity to the meeting point, so a group that moves between
-- sites gets a separate roll call at each one. Activity-level participation is derived in the
-- service layer rather than stored.
--
-- Existing rows are dropped: they carry no meeting point and there is no correct way to infer
-- one (an activity may have several). This only ever held seeded dev data.
DELETE FROM "attendance";

-- DropForeignKey
ALTER TABLE "attendance" DROP CONSTRAINT "attendance_activity_id_fkey";

-- DropIndex
DROP INDEX "attendance_activity_id_idx";

-- DropIndex
DROP INDEX "attendance_activity_id_user_id_key";

-- AlterTable
ALTER TABLE "attendance" DROP COLUMN "activity_id",
ADD COLUMN     "meeting_point_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "attendance_meeting_point_id_idx" ON "attendance"("meeting_point_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_meeting_point_id_user_id_key" ON "attendance"("meeting_point_id", "user_id");

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_meeting_point_id_fkey" FOREIGN KEY ("meeting_point_id") REFERENCES "meeting_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
