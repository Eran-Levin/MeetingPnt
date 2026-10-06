-- UI language, set by the leader who brings someone in and changeable by the person. Plain text
-- so adding a language is a shared-enum edit, not a migration.
ALTER TABLE "users" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
