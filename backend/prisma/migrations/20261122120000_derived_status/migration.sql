-- An event is running or over because of the clock, not because someone pressed a button. The
-- buttons become overrides, recorded as the times they were pressed: started_at ("Start now") and
-- ended_at ("End activity"). Stored status is then only draft, published or cancelled; in_progress
-- and completed are worked out on every read.
ALTER TABLE "activities" ADD COLUMN "started_at" TIMESTAMP(3);
ALTER TABLE "activities" ADD COLUMN "ended_at" TIMESTAMP(3);

-- Existing rows keep their meaning. The moment of the last change is the best record there is of
-- when the button was pressed.
UPDATE "activities" SET "started_at" = "updated_at", "status" = 'published' WHERE "status" = 'in_progress';
UPDATE "activities" SET "ended_at" = "updated_at", "status" = 'published' WHERE "status" = 'completed';
