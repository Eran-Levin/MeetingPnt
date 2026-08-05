# Deployment cookbook

Live: portal `https://app.meetingpnt.com` · API `https://api.meetingpnt.com` · DB Neon · Android via EAS.

`Me` = Eran (dashboards, phone, anything interactive or credentialed). `Claude` = agent (repo, shell,
verification).

---

## Before any push

| # | Action | Who |
|---|---|---|
| 1 | `npm run build:shared` — only if `shared/` changed | Claude |
| 2 | `npm run typecheck` | Claude |
| 3 | `npm run typecheck -w mobile` — only if `mobile/` changed | Claude |
| 4 | `cd mobile && npx expo export --platform android` — only if `mobile/` changed | Claude |
| 5 | Commit and push to `master` | Claude (ask first) |

---

## Backend change

| # | Action | Who |
|---|---|---|
| 1 | Steps above | Claude |
| 2 | Wait for Render auto-deploy (~4–6 min) | — |
| 3 | Check the Render deploy log | Me |
| 4 | Verify `GET /health` returns `{"status":"ok"}` | Claude |
| 5 | Verify a real login returns 200 | Claude |

## Backend change that touches `schema.prisma`

| # | Action | Who |
|---|---|---|
| 1 | Write the migration SQL by hand under `backend/prisma/migrations/<timestamp>_<name>/` | Claude |
| 2 | Apply locally: `npm run db:up`, then `cd backend && npx prisma migrate deploy` | Claude |
| 3 | Stop the backend dev server, then `npm run prisma:generate -w backend` | Claude |
| 4 | Commit migration + schema together, push | Claude (ask first) |
| 5 | Confirm the migration name appears in the Render boot log | Me |
| 6 | Verify `/health` and a login | Claude |

## Portal change

| # | Action | Who |
|---|---|---|
| 1 | Steps in "Before any push" | Claude |
| 2 | Wait for the Cloudflare Workers build | — |
| 3 | Hard-refresh `app.meetingpnt.com` (Ctrl+Shift+R) | Me |
| 4 | Verify page loads, deep link resolves, CORS preflight passes | Claude |

## Mobile change

| # | Action | Who |
|---|---|---|
| 1 | Steps in "Before any push" | Claude |
| 2 | `cd mobile && npx eas-cli@latest build -p android --profile preview` | Claude |
| 3 | Wait for the free-tier queue (hours) | — |
| 4 | Fetch the APK URL: `npx eas-cli@latest build:list --platform android --limit 1` | Claude |
| 5 | Open the APK link on the phone, install over the existing app | Me |
| 6 | Grant notification permission if prompted | Me |

## Env var change — Render

| # | Action | Who |
|---|---|---|
| 1 | Render → service → Environment → edit → Save | Me |
| 2 | Wait for the automatic redeploy | — |
| 3 | Verify the affected behaviour | Claude |

## Env var change — Cloudflare (`VITE_*`)

| # | Action | Who |
|---|---|---|
| 1 | Cloudflare → Worker → Settings → Variables → edit | Me |
| 2 | Trigger **Retry deployment** on the latest build — values are baked at build time | Me |
| 3 | Verify the portal picks up the new value | Claude |

## Reseed the database

| # | Action | Who |
|---|---|---|
| 1 | Open a terminal; `cd backend` | Me |
| 2 | `$env:DATABASE_URL="<neon string with connect_timeout=30>"` and `$env:REDIS_URL=""` | Me |
| 3 | `npx prisma migrate status` — confirm the host is `neon.tech`, not localhost | Me |
| 4 | `npm run seed` | Me |
| 5 | Verify all three personas log in | Claude |

## Rotate the FCM key

| # | Action | Who |
|---|---|---|
| 1 | Firebase → Project settings → Service accounts → Generate new private key | Me |
| 2 | expo.dev → meetingpnt → Credentials → Android → `com.meetingpnt.app` → replace FCM V1 key | Me |
| 3 | Rebuild and reinstall (see "Mobile change") | Claude + Me |

---

## Notes

- Render free tier sleeps after 15 min idle; first request then takes ~50 s.
- `.env` never ships — `**/.env` is in `.dockerignore`, and the seeded connection string lives only
  in the shell session it was set in.
- `google-services.json` is committed on purpose. The FCM **service account key** never is.
- Postponed security work is not covered here. See the list in `BACKLOG.md`.
