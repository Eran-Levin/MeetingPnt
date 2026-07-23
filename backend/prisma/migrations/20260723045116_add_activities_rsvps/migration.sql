-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('draft', 'published', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('driving', 'walking', 'bicycling', 'transit');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('pending', 'approved', 'declined');

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "transport_mode" "TransportMode" NOT NULL DEFAULT 'driving',
    "status" "ActivityStatus" NOT NULL DEFAULT 'draft',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rsvps" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "responded_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_group_id_start_at_idx" ON "activities"("group_id", "start_at");

-- CreateIndex
CREATE INDEX "rsvps_activity_id_status_idx" ON "rsvps"("activity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rsvps_activity_id_user_id_key" ON "rsvps"("activity_id", "user_id");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
