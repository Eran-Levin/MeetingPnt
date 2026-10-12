---
name: meetingpnt-marketing
description: Use for the public website — the landing page at www.meetingpnt.com, its copy (English and Hebrew), pricing wording, the register/sign-up page, page title and description, and the www/app domain setup. Not for in-app screens or behaviour.
---

# MeetingPnt marketing site

The public site is the landing page plus `/register`. Everything below is what we learned shipping it;
`CLAUDE.md` still governs the product itself.

## Where things live

| What | Where |
|---|---|
| The page | `portal/src/pages/LandingPage.tsx` |
| Illustrations and icons | `portal/src/components/landing/art.tsx` (inline SVG, drawn with portal tokens) |
| Copy | `shared/src/locales/en.ts` and `he.ts`, under `portal.landing.*` (and `portal.register.*`) |
| Title, description, link-preview tags | `portal/index.html` |
| Sign-up | `portal/src/pages/RegisterPage.tsx` (creates a **leader** account; `asLeader: true`) |
| Which host shows what | `portal/src/lib/site.ts`, `MarketingGate.tsx`, `ToApp.tsx`, `routes.tsx` |

## What the page is selling

The leader's problem, in their words: see where everyone is, nobody gets lost, never wait for
stragglers. Lead with that, then explain what it does, then price. Structure we use: promise and
a way in, three value tiles, "sound familiar?", three steps, features, who it's for, privacy,
pricing, FAQ, closing call to action. A competitor (tourdash.app) was studied for **structure
only** — never copy its words, stats or claims.

## Claims — the rules that matter

- **No invented proof.** No stats, customer counts, logos, partner names or testimonials unless the
  owner supplies real ones. The phone illustration's sample content ("Old Port fountain", "Dana") is
  illustrative and the owner knows it.
- **Only claim what is built.** Check `CLAUDE.md` and `BACKLOG.md`. Location sharing is limited to a
  running event and closes when it ends — say that, nothing broader. The Android app is distributed
  internally, there is no store listing: don't link to or imply one. Don't claim iOS.
- **Price is "free to try, TBD".** "No card needed" and "we'll tell you before anything changes" are
  promises the owner has accepted. Do not add, remove or soften pricing or promise wording without
  asking.
- **Call to action is "Try for free"** and points at `/register`.

## Language

- **English first.** Settle the English with the owner; only then translate. Hebrew keys must exist
  alongside English (the `Catalog` type enforces identical keys — `npm run typecheck` is the check).
- **Hebrew uses the app's own vocabulary:** פעילות (activity/event), טיוטה (draft), אורח (visitor),
  נקודת מפגש (meeting point), התחברות (sign in). Plural imperative for buttons (נסו בחינם),
  gender-neutral elsewhere. The owner is a native reader and reviews on the branch preview; a general
  rule from them applies catalog-wide, not row by row.
- Look at Hebrew in the browser too: layout mirrors; the brand name stays at the start of an RTL line.

## Domains and deploys

- `www.meetingpnt.com` shows **only** the landing page (and sends a signed-in visitor to the app).
  `app.meetingpnt.com` is the application; signed out at `/` it sends visitors to `www`. Bare
  `meetingpnt.com` redirects to `www` (Cloudflare Redirect Rule). One build serves both; the host decides.
- `VITE_APP_URL` and `VITE_MARKETING_URL` are **baked in at build time** (Cloudflare → Worker →
  Settings → Build → Variables). Saving a variable does not start a build. `*.workers.dev` previews
  deliberately ignore them and stay on their own address.
- `www` must be in the API's `CORS_ORIGINS` (Render) or the signed-in redirect silently fails.
- The portal waits on the API's session check; on `www` it must not (a sleeping free-tier API
  once left the public page on "Loading…"). Keep marketing pages independent of the API.
- Full checklist: `DEPLOYMENT.md` → "Public site on www.meetingpnt.com".

## Workflow

1. Branch from `master`.
2. Edit; check in the browser at **phone width** and wide (the capture crops wide pages — review the
   structure by measurement if needed).
3. `npm run build:shared`, then `npm run typecheck`.
4. Push, open a PR (draft while the copy is still moving). The Cloudflare bot comment on the PR
   carries the **Branch Preview URL** — give it to the owner; they review there.
5. **Merge only when the owner says so.** Then wait for the production build and verify on the live
   domain (e.g. a string from the new copy appears in the served bundle).

## Hand-offs

- Copy that promises a capability: confirm it exists — otherwise stop and use the features skill.
- Colours, spacing, dropdown styles, amount of text: use `meetingpnt-ui`.

## Known and accepted

Open leader sign-up is public while the API has no rate limiting and the seeded `password123`
accounts are live (`BACKLOG.md`). The owner has accepted this for now; mention it when it's relevant
to a launch, don't re-litigate.
