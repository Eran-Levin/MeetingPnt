-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('omw', 'ping_response');

-- CreateTable
CREATE TABLE "meeting_points" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "activity_id" TEXT,
    "label" TEXT,
    "location" geography(Point,4326) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "reconvene_time" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_snapshots" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meeting_point_id" TEXT,
    "location" geography(Point,4326) NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "eta_seconds" INTEGER,
    "eta_computed_at" TIMESTAMP(3),
    "source" "LocationSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_points_activity_id_idx" ON "meeting_points"("activity_id");

-- CreateIndex
CREATE INDEX "location_snapshots_activity_id_user_id_created_at_idx" ON "location_snapshots"("activity_id", "user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "meeting_points" ADD CONSTRAINT "meeting_points_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_points" ADD CONSTRAINT "meeting_points_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_points" ADD CONSTRAINT "meeting_points_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_snapshots" ADD CONSTRAINT "location_snapshots_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_snapshots" ADD CONSTRAINT "location_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_snapshots" ADD CONSTRAINT "location_snapshots_meeting_point_id_fkey" FOREIGN KEY ("meeting_point_id") REFERENCES "meeting_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;
