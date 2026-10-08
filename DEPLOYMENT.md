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

## Testing on a phone against the local backend

The `preview` APK cannot do this. It is a release build: the JavaScript is compiled in and
`https://api.meetingpnt.com` is baked into it, so it always runs its own code against production.
Pointing it at a local machine is not a configuration problem, it is impossible. A client asked for
a bundle it cannot fetch reports **"Failed to download remote update"**.

Use a **development build** instead — built once from the `development` profile, it loads its
JavaScript from Metro on your machine and supports push, which Expo Go does not (Android remote
push was dropped there in SDK 53).

| # | Action | Who |
|---|---|---|
| 1 | `cd mobile && npx eas-cli@latest build -p android --profile development --non-interactive --no-wait` | Claude |
| 2 | Install the APK — a one-off, not repeated per code change | Me |
| 3 | Set `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_SOCKET_URL` in `mobile/.env` and `BACKEND_PUBLIC_URL` in `backend/.env` to the machine's current LAN IP | Me |
| 4 | `npm run dev:backend`, then `cd mobile && npx expo start -c` | Claude |
| 5 | Open the dev build on the phone; it connects to Metro over the LAN | Me |

Rebuild only when native dependencies change. Ordinary JS edits reload from Metro.

The `development` profile deliberately sets **no** `EXPO_PUBLIC_API_BASE_URL`. `EXPO_PUBLIC_*` is
inlined by whichever bundler produces the JavaScript, and for a development build that is local
Metro reading `mobile/.env` — so a value here would never reach the app while looking like it
governs the thing. It previously held a LAN address that had long since gone stale.

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

## Environments (free plan)

| | Production | Staging |
|---|---|---|
| Branch | `master` | `staging` |
| Portal | `app.meetingpnt.com` | Cloudflare branch preview of `staging` |
| API | `api.meetingpnt.com` (Render) | `meetingpnt-api-staging.onrender.com` (Render) |
| Database | Neon `main` branch | Neon `staging` branch — starts as a copy of production, then diverges |
| Photos | Backblaze B2 bucket | the same bucket, or a second one |
| Phone app | EAS channel `production` | EAS channel `staging` (build profile `staging`) |

Day to day: push to `staging`, test from any machine, merge to `master` when it's good. Every
Cloudflare *preview* of the portal, for any branch, talks to staging and never to production —
the choice is made from the host name in `portal/src/lib/env.ts`, because Cloudflare gives all
builds the same variables.

### Free-tier limits that shape this

Figures are from each provider's pricing page as of October 2026. Check before relying on them.

| Service | Limit | What it means here |
|---|---|---|
| Render | **750 instance hours a month, shared by every free service.** Spins down after 15 idle minutes; waking takes up to a minute. | One service kept awake 24/7 uses ~720 hours, leaving none for staging — and when the pool runs out Render suspends **all** free services, production included, until the 1st. So nothing is pinged on a schedule. Run `npm run wake` before a test session instead. |
| Neon | 10 branches, 100 compute-hours per project a month, 0.5 GB storage per project (branches share it). Compute sleeps after 5 idle minutes. | Plenty for one staging branch. |
| Backblaze B2 | First 10 GB free; Backblaze says no card is needed to sign up. | Photos. |
| EAS Update | 1,000 monthly active users free. | JS fixes reach phones without a build. |

### One-time setup — photos (Backblaze B2)

Render's free disk is wiped on every restart, so without this uploaded photos disappear.

| # | Action | Who |
|---|---|---|
| 1 | backblaze.com → sign up → Buckets → Create a bucket, name `meetingpnt-uploads`, **Public** | Me |
| 2 | On the bucket page note the **S3 endpoint** (`s3.<region>.backblazeb2.com`) and the **friendly URL** base (`https://fNNN.backblazeb2.com/file/meetingpnt-uploads`) | Me |
| 3 | Application Keys → Add a new key, limited to that bucket, read + write. The secret is shown once | Me |
| 4 | Render → service → Environment, on **both** services: `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION` (the `<region>` part), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` (the friendly URL, no trailing slash needed) | Me |
| 5 | Upload a profile photo; confirm it loads and survives a redeploy | Claude + Me |

The key goes only into Render's dashboard — never into chat, a commit or `.env` in git. The
server refuses to boot with `STORAGE_DRIVER=s3` if any value is missing, naming it. Photos already
on a local disk are not migrated.

### One-time setup — staging

| # | Action | Who |
|---|---|---|
| 1 | Neon console → Branches → create `staging` from `main`; copy its connection string (add `connect_timeout=30`) | Me |
| 2 | Render → New → Web Service → this repo, branch `staging`, runtime Docker, Dockerfile `backend/Dockerfile`, root directory empty, **name `meetingpnt-api-staging`**, Free | Me |
| 3 | Its environment: `NODE_ENV=production`, `DATABASE_URL` (the staging branch), **new random** `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, `BACKEND_PUBLIC_URL` (its own URL), `PORTAL_URL` and `CORS_ORIGINS` (the staging portal URL), the `S3_*` values from above, and `GOOGLE_MAPS_API_KEY` / `RESEND_*` copied from production | Me |
| 4 | Create and push the `staging` branch from `master` | Claude |
| 5 | Cloudflare → Worker → Settings → Build variables: `VITE_STAGING_API_BASE_URL` = the staging API URL. Retry the `staging` build | Me |
| 6 | `cd mobile && npx eas-cli@latest build -p android --profile staging --non-interactive --no-wait` | Claude |
| 7 | Install that APK on the test phones — once, not per change | Me |
| 8 | `npm run wake`, then check `/health` and a login against staging | Claude |

If Render won't give the service the exact name in step 2, tell Claude: the `staging` profile in
`mobile/eas.json` bakes that URL in and has to match.

Staging starts as a **copy of production data**, because that is what a Neon branch is. If
production ever holds real people's data, branch from an empty or seeded database instead.

### Waking the servers

`npm run wake` calls `/health` on both and prints how long each took. A sleeping server takes up to
a minute; run it, wait, then test.

### Phone updates without a build (EAS Update)

| Change | What to do | Who |
|---|---|---|
| JavaScript or text only | `cd mobile && npx eas-cli@latest update --channel staging --message "<what>"` — phones on that channel pick it up after the app is restarted once or twice | Claude |
| A native dependency, a config plugin, or native settings in `app.json` | Bump `version` in `mobile/app.json` (the runtime version follows it) and build again | Claude + Me |

An update is only delivered to builds with the same `version`. That is the safety: an update that
needs a native module can't reach an APK that doesn't have it.

---

## Notes

- Render free tier sleeps after 15 min idle; first request then takes ~50 s. Run `npm run wake` before
  testing — see "Environments (free plan)" for why nothing pings on a schedule.
- `.env` never ships — `**/.env` is in `.dockerignore`, and the seeded connection string lives only
  in the shell session it was set in.
- `google-services.json` is committed on purpose. The FCM **service account key** never is.
- Postponed security work is not covered here. See the list in `BACKLOG.md`.
