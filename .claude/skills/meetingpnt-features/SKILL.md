---
name: meetingpnt-features
description: Use when adding or changing what MeetingPnt does — new or altered behaviour, backend endpoints, database/Prisma changes, shared types and schemas, or mobile/portal logic. Start here before building, and for how to verify and ship it. Not for purely cosmetic changes (use meetingpnt-ui) or website copy (use meetingpnt-marketing).
---

# MeetingPnt features

`CLAUDE.md` holds the product decisions; this is the procedure for changing behaviour without
repeating past mistakes.

## 1. Decide before you build

- **Web plans, mobile runs.** Check the table at the top of `CLAUDE.md`. A feature on the wrong side
  is how six features got built and removed. If it doesn't fit the table, stop and ask.
- **Read the model decisions in `CLAUDE.md`** that touch the area (attendance, itinerary, events,
  visitors, location sharing, drafts). Most surprises are already written down.
- **Check `BACKLOG.md`.** Deferred items were deferred deliberately; don't quietly build one, and
  delete its entry when it lands.
- A change that alters what the product *does* may change what the website *promises* — tell the
  owner, and hand the wording to `meetingpnt-marketing`.

## 2. Build

- Shared types and zod schemas live in `shared/`; **`npm run build:shared`** before other workspaces
  see an edit.
- New user-facing text needs an English **and** Hebrew key (typecheck enforces identical keys; `{{blanks}}`
  must match). Use the app's Hebrew vocabulary.
- Mobile: extensionless relative imports; only packages declared in `mobile/package.json`.
- Database: `prisma migrate dev` won't run non-interactively — write the migration SQL by hand and
  `prisma migrate deploy`; check `npx prisma migrate status` names `localhost`, never `neon.tech`.
  PostGIS columns go through raw SQL in `backend/src/db/geo.ts`. `prisma generate` fails (`EPERM`)
  while the backend runs.
- Free tiers only, no card. Don't add a paid service; don't schedule keep-alive pings (they would
  burn Render's shared 750 hours).

## 3. Verify against the real scenario

Test the situation the owner described, not a convenient one (ordering bugs hid behind test data that
happened to line up). Then:

- `npm run typecheck` (shared, backend, portal) and `npm run typecheck -w mobile`.
- **`tsc` passing does not mean mobile works** — run `npx expo export --platform ios`.
- Clean up any rows you create; the local database is the one being tested by hand. Local servers
  started for your own checking get stopped afterwards — the owner tests in the cloud, not on a
  local setup.

## 4. Ship

- Branch → PR → wait for the check → **merge only when the owner says so**.
- Server and portal deploy from `master` (Render, Cloudflare). Phone app changes ship with
  `npm run update:mobile -- "what changed"` **from `master`, tree clean**; the app must be reopened
  twice. A native dependency or config-plugin change needs a new APK instead (`DEPLOYMENT.md`).
- Production data matters: don't run the seed or destructive scripts against the deployed database.

## 5. Leave it recorded

If you made or changed a product decision, update `CLAUDE.md` (the *why*, briefly). If you
consciously deferred something, add it to `BACKLOG.md` with the reasoning.
