-- Which app "Directions" opens for this person (google_maps | waze). Plain text, like locale, so
-- adding an app is a shared-enum edit rather than a migration.
ALTER TABLE "users" ADD COLUMN "nav_app" TEXT NOT NULL DEFAULT 'google_maps';
