-- The leader can now plan an activity's whole itinerary before it runs, which breaks the old
-- assumption that the newest meeting point is where the group is standing. Two additions split
-- the plan from the progress through it:
--
--   meeting_points.arrived_at        when the group actually reached this stop (null = still planned)
--   activities.current_meeting_point_id  where the group is right now
--
-- Both are maintained together whenever the leader advances the group.

ALTER TABLE "meeting_points" ADD COLUMN "arrived_at" TIMESTAMP(3);
ALTER TABLE "activities" ADD COLUMN "current_meeting_point_id" TEXT;

-- Not declared as a Prisma relation: activities -> meeting_points -> activities would be a
-- cascade cycle. Clearing the pointer is the right behaviour if the stop itself is deleted.
ALTER TABLE "activities"
  ADD CONSTRAINT "activities_current_meeting_point_id_fkey"
  FOREIGN KEY ("current_meeting_point_id") REFERENCES "meeting_points"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill. Every existing meeting point was created by a leader as the group arrived, so on
-- activities that have run they were all reached; creation time is the best record of when.
UPDATE "meeting_points" mp
SET "arrived_at" = mp."created_at"
FROM "activities" a
WHERE mp."activity_id" = a."id"
  AND a."status" IN ('in_progress', 'completed');

-- Points on activities that haven't run yet are plans, not visits, so they stay null.

-- For activities that have run, the group's last position is the most recently created stop —
-- exactly what the old derivation returned, so nothing appears to move.
UPDATE "activities" a
SET "current_meeting_point_id" = (
  SELECT mp."id" FROM "meeting_points" mp
  WHERE mp."activity_id" = a."id"
  ORDER BY mp."created_at" DESC
  LIMIT 1
)
WHERE a."status" IN ('in_progress', 'completed');

CREATE INDEX "meeting_points_activity_id_arrived_at_idx"
  ON "meeting_points"("activity_id", "arrived_at");
