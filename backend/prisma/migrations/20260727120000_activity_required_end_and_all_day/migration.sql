-- Every activity now has an end, and multi-day activities are date-only.

-- Add the all-day flag first so the backfill below can set it.
ALTER TABLE "activities" ADD COLUMN "all_day" BOOLEAN NOT NULL DEFAULT false;

-- Backfill missing ends. One hour is an arbitrary but harmless default for the single-point-in-time
-- activities that predate this column; leaders can correct any that matter.
UPDATE "activities" SET "end_at" = "start_at" + INTERVAL '1 hour' WHERE "end_at" IS NULL;

-- Anything already spanning more than one calendar day was a multi-day trip, so treat it as
-- date-only and normalise it to cover whole days.
UPDATE "activities" SET "all_day" = true WHERE date("end_at") > date("start_at");
UPDATE "activities"
SET "start_at" = date_trunc('day', "start_at"),
    "end_at" = date_trunc('day', "end_at") + INTERVAL '1 day' - INTERVAL '1 second'
WHERE "all_day" = true;

-- AlterTable
ALTER TABLE "activities" ALTER COLUMN "end_at" SET NOT NULL;
