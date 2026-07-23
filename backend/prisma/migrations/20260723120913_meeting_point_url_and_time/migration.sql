/*
  Warnings:

  - You are about to drop the column `is_primary` on the `meeting_points` table. All the data in the column will be lost.
  - You are about to drop the column `reconvene_time` on the `meeting_points` table. All the data in the column will be lost.
  - Added the required column `google_maps_url` to the `meeting_points` table without a default value. This is not possible if the table is not empty.
  - Added the required column `time` to the `meeting_points` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "meeting_points_activity_id_idx";

-- AlterTable
ALTER TABLE "meeting_points" DROP COLUMN "is_primary",
DROP COLUMN "reconvene_time",
ADD COLUMN     "google_maps_url" TEXT NOT NULL,
ADD COLUMN     "time" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "meeting_points_activity_id_time_idx" ON "meeting_points"("activity_id", "time");
