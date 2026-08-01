# MeetingPnt

Coordination app for group leaders who run recurring or multi-day events: photography walks,
yoga classes, guided tours. npm workspaces monorepo — `backend`, `portal` (web), `mobile`
(Expo), `shared` (types + zod schemas used by all three).

## The decision that governs everything: Web plans, Mobile runs

This split caused six features to be built and then removed. Check it before adding UI.

| | Web (portal) | Mobile |
|---|---|---|
| Groups, rosters, invitations | ✅ | read-only |
| Scheduling, recurrence, publishing | ✅ | possible, rarely used |
| **Initial** meeting point | ✅ set + edit one | edit it |
| **Further** meeting points mid-event | ❌ | ✅ |
| Attendance / roll call | ❌ | ✅ |
| Live location, ETA, pings | ❌ | ✅ |
| Post-event review | ✅ (not built — see BACKLOG.md) | ❌ |

Mobile's home is a **timeline of events**, not a list of groups — a leader's day is "what's
happening", and a running event must be reachable the moment they log in.

## Model decisions worth knowing

- **Attendance hangs off the meeting point, not the activity.** A group that moves between sites
  needs a roll call at each. Activity-level participation is *derived* (present at ≥1 point), never
  stored. Single-point activities behave identically, so yoga billing is unaffected.
- **The roster narrows as the group moves.** First meeting point expects everyone who hasn't
  declined; every later one expects only those marked present at the previous one. See
  `getRollCall` in `backend/src/modules/attendance/service.ts`.
- **Meeting points are ordered by `created_at`, not `time`** — creation order is the sequence the
  group actually walks. Ordering by `time` breaks the moment a point is dropped mid-event on a
  future-dated activity ("now" sorts before the planned start). The ETA target is chosen
  separately, by time (`getNextUpcomingMeetingPoint`).
- **Every activity has a start and an end.** `allDay` activities are date-only (multi-day trips);
  timed ones are one date plus two clock times. Render both via `formatActivityWhen` in
  `shared/src/utils` so the two clients can't drift.
- **A leader runs one event at a time.** `startActivity` refuses (409) if that leader already has
  an activity `in_progress` — they can't be in two places at once. Scoped per leader, so other
  leaders are unaffected. Ending one frees them to start the next.
- **Ending an event closes location sharing.** OMW and pings return 409 once an activity is
  `completed`, and the socket room refuses joins. Attendance stays editable — leaders reconcile
  after the fact.
- **Drafts are the leader's private planning space.** Never expose them to members (this leaked
  once).
- **Visitors** (`ActivityGuest`) attend one activity without joining the group. They appear in the
  RSVP dashboard tagged as visitors, including those who haven't replied yet — a visitor with no
  RSVP row is synthesised into the list so an invitation is never invisible.

## Member experience

- Members see the **names of who's coming**, not the leader's roll call.
- Members see **only the current meeting point** — no history of earlier stops.
- Events awaiting a reply are **flagged on the event card** in their timeline.

## Traps that have bitten

- **Metro does not resolve TypeScript's `.js` import convention.** `from './foo.js'` pointing at
  `foo.ts` typechecks fine and fails to bundle. Use extensionless relative imports in `mobile/`.
- **`tsc` passing does not mean mobile works.** Verify with `npx expo export --platform ios`,
  which exercises the real entry point and route tree.
- **Only import packages declared in `mobile/package.json`.** Transitive deps resolve for `tsc`
  (hoisted at the root) but not reliably for Metro.
- **Prisma engine lock:** `prisma generate` fails with `EPERM` while the backend dev server is
  running. Stop it first.
- **`prisma migrate dev` refuses to run non-interactively** whenever it wants to warn. Write the
  migration SQL by hand and apply with `prisma migrate deploy`.
- **PostGIS columns are `Unsupported`** — Prisma Client can't read or write them. All meeting-point
  and location-snapshot access goes through raw SQL in `backend/src/db/geo.ts`.
- **The repo spans two React majors** — mobile is on 19 (Expo SDK 54), the portal still on 18. npm
  hoists 19 to the root, so `portal/tsconfig.json` pins `react`/`react-dom` types to its own nested
  copy. Without that, every JSX element fails to typecheck.
- **`BACKEND_PUBLIC_URL`** must be the LAN IP for phone testing, or chat images 404 on device.

## Working here

```bash
npm run db:up            # postgres + redis
npm run dev:backend      # :4000  (binds all interfaces, so LAN-reachable)
npm run dev:portal       # :5173
cd mobile && npx expo start -c   # own terminal; -c after any native dep change
npm run typecheck        # shared + backend + portal
npm run typecheck -w mobile
npm run build:shared     # required after editing shared/ before other workspaces see it
cd backend && npm run seed
```

Seeded logins are `photoinstructor@`, `yogainstructor@`, `tourguide@example.com` and
`member1..15@example.com`, all `password123`; admin is `admin@meetingpnt.dev` / `changeme123`.

**Verify against the user's actual scenario, not a convenient one.** A bug shipped because
meeting-point ordering was tested on an activity whose times happened to match creation order,
which never exercised the mid-event case. Clean up test rows afterwards — this database is the
one being manually tested.

`BACKLOG.md` records consciously deferred work and why.
