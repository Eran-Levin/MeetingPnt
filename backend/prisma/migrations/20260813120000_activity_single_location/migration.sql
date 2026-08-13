-- A yoga class happens in one room: there is no route to plan. Stored rather than inferred from
-- the number of meeting points, because a walk that is still being planned also has one stop and
-- must keep its "add stop" affordance.
--
-- Defaults to false so every existing activity keeps its itinerary.
ALTER TABLE "activities" ADD COLUMN "single_location" BOOLEAN NOT NULL DEFAULT false;
