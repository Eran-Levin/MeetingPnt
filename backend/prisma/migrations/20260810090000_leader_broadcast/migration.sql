-- "Follow me": the leader shares a live position, as a tour guide holds up a flag.
--
-- The lease is a timestamp rather than a boolean. Broadcasting must have an end that arrives on
-- its own: a phone that dies or an app that is force-quit mid-trek would otherwise leave the
-- channel open forever, and for a design built on discrete, consented location snapshots that is
-- the wrong resting state. The leader's own fixes renew it while they're still sharing.
ALTER TABLE "activities" ADD COLUMN "leader_broadcast_until" TIMESTAMP(3);

-- Broadcast fixes are their own kind of position: unlike an OMW or a ping response they are not
-- someone travelling towards the meeting point, so they carry no ETA.
--
-- Safe inside the migration's transaction on PostgreSQL 12+ because nothing here *uses* the new
-- label; the first write that does happens in a later transaction.
ALTER TYPE "LocationSource" ADD VALUE IF NOT EXISTS 'leader_broadcast';
