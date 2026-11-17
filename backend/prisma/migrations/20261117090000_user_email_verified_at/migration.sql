-- When the user proved the address is theirs. Only a self-registered leader has to: everyone else
-- arrives through a link that was emailed to them. Accounts that already exist are taken as
-- confirmed, or every leader would be locked out the day this ships.
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);
UPDATE "users" SET "email_verified_at" = "created_at";
