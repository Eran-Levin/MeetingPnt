-- Members are identified by a real first and last name, collected by the leader at invite time,
-- plus a phone number so a leader can reach someone who hasn't turned up.
--
-- Existing rows carry a single `name`. Split it on the first space: everything before becomes the
-- first name, everything after the last name. Single-word names ("Admin") keep the whole string as
-- the first name and get an empty last name rather than losing data.

ALTER TABLE "users" ADD COLUMN "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN "last_name" TEXT;
ALTER TABLE "users" ADD COLUMN "phone" TEXT;

UPDATE "users"
SET "first_name" = COALESCE(NULLIF(split_part("name", ' ', 1), ''), "name"),
    "last_name"  = COALESCE(NULLIF(substring("name" FROM position(' ' IN "name") + 1), "name"), '');

ALTER TABLE "users" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "last_name" SET NOT NULL;

ALTER TABLE "users" DROP COLUMN "name";

-- The leader supplies these when inviting; they seed the account the invitee creates.
ALTER TABLE "invitations" ADD COLUMN "first_name" TEXT;
ALTER TABLE "invitations" ADD COLUMN "last_name" TEXT;
ALTER TABLE "invitations" ADD COLUMN "phone" TEXT;
