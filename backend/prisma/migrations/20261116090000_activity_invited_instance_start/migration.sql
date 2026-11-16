-- The start an occurrence had when its series was invited as one repeating calendar entry.
-- Null for an event invited on its own.
ALTER TABLE "activities" ADD COLUMN "invited_instance_start" TIMESTAMP(3);
