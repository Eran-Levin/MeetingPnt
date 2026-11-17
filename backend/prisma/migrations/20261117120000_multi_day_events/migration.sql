-- A multi-day event groups day events (activities) for planning and the calendar.
CREATE TABLE "multi_day_events" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "multi_day_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "multi_day_events_group_id_idx" ON "multi_day_events"("group_id");

ALTER TABLE "multi_day_events" ADD CONSTRAINT "multi_day_events_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activities" ADD COLUMN "multi_day_event_id" TEXT;

CREATE INDEX "activities_multi_day_event_id_idx" ON "activities"("multi_day_event_id");

ALTER TABLE "activities" ADD CONSTRAINT "activities_multi_day_event_id_fkey"
  FOREIGN KEY ("multi_day_event_id") REFERENCES "multi_day_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
