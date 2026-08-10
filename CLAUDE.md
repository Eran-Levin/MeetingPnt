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
| **Itinerary** (all meeting points) | ✅ plan the route | edit it |
| **Moving the group** between stops | ❌ | ✅ |
| Attendance / roll call | ❌ | ✅ |
| Live location, ETA, pings | ❌ | ✅ |
| Post-event review | ✅ (not built — see BACKLOG.md) | ❌ |

Mobile's home is a **timeline of events**, not a list of groups — a leader's day is "what's
happening", and a running event must be reachable the moment they log in.

## How the three personas map onto groups

A yoga class and a photo-walk club are **standing communities**: the group persists, events recur
inside it. A trip is not. **For a tour guide, the group *is* the trip** — "Peru Andes Trek, 1 Sept
departure" is a cohort who booked one departure and will never assemble again, so the roster is the
manifest and **Close group** is the end of the trip, not an administrative tidy-up. A guide running
the same route twice creates a second group (copying a roster across is deferred — see BACKLOG).

Inside a trip, **a day is an event**, not one week-long activity. Two reasons:

- The roll call has to start fresh each morning. Carried forward across a week, one skipped
  afternoon would erase someone from every later day.
- Mobile's home is a timeline; a week-long activity is a single card for seven days, so "what's
  happening today" would have nowhere to live.

Nobody re-confirms each morning — trip days are `requiresRsvp: false`, so everyone starts approved
and declining one day is how you sit it out. The pre-trip gathering and post-trip reunion are just
ordinary events in the same group, and they *do* take RSVPs.

## Model decisions worth knowing

- **Starting an event hands over from the one already running in that group.** Day 3 of a trek
  takes over from day 2 rather than being refused, which is what keeps a multi-day trip continuous:
  the old event runs right up to the new one starting, so location sharing never lapses overnight —
  the gap between an evening's end and the next morning's start is exactly when a guide most needs
  to find someone. Across *different* groups it stays a 409: a leader can't be in two places at
  once, and silently ending another group's event would close sharing on people still out there.
  This only tidies up when there *is* a next start (see BACKLOG for the sweep that finishes it).
- **Attendance hangs off the meeting point, not the activity.** A group that moves between sites
  needs a roll call at each. Activity-level participation is *derived* (present at ≥1 point), never
  stored. Single-point activities behave identically, so yoga billing is unaffected.
- **The roster narrows as the group moves.** First meeting point expects everyone who hasn't
  declined; every later one expects only those marked present at the previous one. See
  `getRollCall` in `backend/src/modules/attendance/service.ts`.
- **The plan and the progress through it are separate things.** A leader can map the whole route
  before setting off, so "where is the group now" cannot be derived from the list of points.
  `Activity.currentMeetingPointId` is where they are; `MeetingPoint.arrivedAt` is the trail of
  stops actually visited (null = still planned). Both move together in `advanceToNextMeetingPoint`.
  This replaced an earlier rule that the newest point was the current one — true only while points
  were created as the group arrived, and quietly wrong the moment planning came along.
- **Meeting points are ordered by `created_at`, not `time`** — creation order is the route as
  planned. Ordering by `time` breaks the moment a point is dropped mid-event on a future-dated
  activity ("now" sorts before the planned start).
- **Everyone sees the whole itinerary — the difference is presentation, not access.** Members were
  briefly restricted to the current stop; that solved the wrong problem. The route isn't secret,
  and knowing the shape of the day is useful. The real risk is a member glancing at their phone and
  not knowing which pin is theirs, so **where to go now leads, and the route sits underneath** with
  visited stops greyed, the current one picked out, and the rest reading as plan. Drafts still
  never reach members.
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
- Members see the **whole route**, led by where to go now (see the itinerary decision above).
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
`member1..30@example.com`, all `password123`; admin is `admin@meetingpnt.dev` / `changeme123`.

**Each seeded member belongs to exactly one leader** — `member1..10` to the photo instructor,
`member11..20` to the yoga instructor, `member21..30` to the tour guide. Members overlap freely
between groups of the *same* leader (the yoga classes share four students; two Andes trekkers
rebook for Iceland), never across leaders. The pool used to be shared, which is unlike anything
real and made every member-facing screen ambiguous to test: one login's timeline was stitched
together from three unrelated leaders. `member10` is deliberately on no roster — a visitor-only
user, so the `ActivityGuest` path has a subject.

The seed is idempotent by *skipping*: `ensureGroup` returns early when a group of that name
already exists, so changing a roster in `seed.ts` has no effect on a database that already has it.
Re-partitioning means `npx prisma migrate reset --force --skip-seed` first — check
`npx prisma migrate status` names `localhost`, never `neon.tech`.

**Verify against the user's actual scenario, not a convenient one.** A bug shipped because
meeting-point ordering was tested on an activity whose times happened to match creation order,
which never exercised the mid-event case. Clean up test rows afterwards — this database is the
one being manually tested.

`BACKLOG.md` records consciously deferred work and why.
