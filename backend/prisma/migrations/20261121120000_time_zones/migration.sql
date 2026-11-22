-- Time zone at three levels, most specific winning: the event, its group, the leader. All are
-- IANA names ("Asia/Jerusalem"); null means "inherit". A leader with none falls back to UTC.
ALTER TABLE "users" ADD COLUMN "time_zone" TEXT;
ALTER TABLE "groups" ADD COLUMN "time_zone" TEXT;
ALTER TABLE "activities" ADD COLUMN "time_zone" TEXT;
