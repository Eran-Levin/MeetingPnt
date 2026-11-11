-- The secret in a user's calendar subscription link. Calendar apps can't log in, so the link itself
-- is the credential: null until they first ask for it, replaced when they reset it.
ALTER TABLE "users" ADD COLUMN "calendar_token" TEXT;
CREATE UNIQUE INDEX "users_calendar_token_key" ON "users"("calendar_token");
