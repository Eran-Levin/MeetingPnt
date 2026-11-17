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
- **A multi-day event is a container of day events** (`MultiDayEvent`, MPNT-33). A trip, or a
  workshop weekend inside a standing group: the leader plans and publishes it as one thing, while
  each day stays a real event with its own stops and roll call (see "a day is an event" above).
  Used everywhere, including a tour guide's group, which also holds ordinary events around the trip
  (a briefing before, a summary after). The container stores no dates — they are its days'.
  Publishing it sends ONE push and ONE all-day calendar entry spanning the days (`multiday-<id>`,
  the days listed in the description), and a day's own publish/edit/delete re-sends that entry
  rather than a per-day invitation. Draft days stay off the entry. Built so far: create (portal,
  `/groups/:id/multi-day/new`), publish all, group-page card, and the mobile timeline card: one
  card per event led by its next day ("Day 3 of 5", so today's while the trip is on), the other
  days under "Show all days", finished events collapsed to one row. The day numbering comes from
  `listMyActivities` (`multiDay`), counted over the days the caller can see, not just those in the
  timeline's lookback. The leader can also edit, move, copy and delete the whole event from its
  group-page card. **Rename** renames the days that carry the old title as a prefix ("Peru Trek ·
  Day 2"); a day titled by hand is left alone. **Move** shifts every day and stop by whole days in
  the leader's time zone, and is refused once any day has started. **Copy** is done from the
  *target* group, not from the event: the new multi-day page has "Copy from existing", which lists
  multi-day events (not their days) across the leader's groups and creates the copy in the group the
  page is for — drafts only, days and stops across, RSVPs and attendance left behind. A copy button
  on the event's own card was tried and removed: it only ever copied into the same group, which is
  not how a trip is rerun. The single-activity "Copy from existing" no longer lists days of a
  multi-day event. Duplicating a group with "copy events" keeps its multi-day events grouped.
  **Delete** is refused once a day is running or over, and sends one cancellation for the whole
  calendar entry. **RSVP at the container level** is for events that take RSVPs: while a member
  has an unanswered day that hasn't started, the timeline card offers "Coming to all days" / "Can't
  make it" (`POST /multi-day-events/:id/rsvp`). It answers every published day that hasn't started,
  replacing earlier answers on those days, and a day can still be answered alone afterwards — that
  is how someone sits one out. Started days are skipped (RSVP locks at the start); a day published
  later arrives with the normal default rather than inheriting the answer. There is no stored
  "trip answer": it is just the days' own RSVPs, set together.
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
- **Copying an activity carries its shape, not its history.** The portal's "Copy from existing" fills
  the create form from any activity the leader runs, in any group, moved to a new date. Title,
  description, transport, RSVP and single-location settings and every stop come across; each stop keeps
  its distance from the start (stored as absolute times, created from offsets), a trip keeps its length.
  RSVPs, attendance, status and any recurrence stay behind — copying one occurrence of a series gives
  one draft. It's a prefill, not a clone: the leader still reviews the form and creates it as a draft.
- **A new group can start from an existing one — two independent choices: the roster, the events.** "Copy roster" is the
  2025 group continuing into 2026 (same people, new events); "copy events" is the same tour run for
  new people. Events arrive as drafts moved by whole days in the leader's own time zone (sent by the
  browser, since the server runs UTC) so an 08:00 start stays 08:00 across a daylight-saving change.
  Same shape as copying an activity: the shape comes across, the history doesn't. All of it is
  editable afterwards on the new group.
- **A leader runs one event at a time.** `startActivity` refuses (409) if that leader already has
  an activity `in_progress` — they can't be in two places at once. Scoped per leader, so other
  leaders are unaffected. Ending one frees them to start the next.
- **A member can leave an event that is under way.** It is a self-marked `absent` at the stop the
  group is at (`leaveActivity` in the attendance service, `markedBy` = themselves), so the roster
  narrowing needs no new rule: they drop off every later stop, keep credit for earlier ones, and
  the leader sees "Left" in the roll call. **Leaving also stops their location sharing** — OMW,
  ping replies and leader pings return 409 once `hasLeft` (absent at some stop, not present at the
  current one). No rejoin button; the leader re-marking them Here at the current stop is the undo,
  which stops being possible once the group moves on (they're off that roster). Leaders can't
  leave; they end the event.
- **Ending an event closes location sharing.** OMW and pings return 409 once an activity is
  `completed`, and the socket room refuses joins. Attendance stays editable — leaders reconcile
  after the fact.
- **A leader who signs up on their own confirms their email before creating a group.** Nobody
  else is asked: a member arrives through a link that was emailed to them, which already proves the
  address, while a sign-up form proves nothing — and a leader's address is where invitations appear
  to come from. `User.emailVerifiedAt` null + role `leader` is the held-back state
  (`backend/src/modules/auth/emailVerification.ts`); they can sign in, the portal shows "Confirm
  your email" in place of the app, and `requireVerifiedEmail` refuses creating or copying a group.
  The link is a signed token, not a stored one, and uses its own secret so it can't double as a
  sign-in token. Accounts that existed before this were marked confirmed by the migration, and the
  seed marks its own (`example.com` can't receive mail).
- **An email that can't be sent is an error, never a quiet success.** Everything goes through
  `deliver` in `backend/src/lib/resendClient.ts`, which throws `email_send_failed` when Resend
  refuses or — in production — when there is no API key. This was learned the hard way: with no
  key the server logged the email and reported success, so group invitations looked sent for
  months and none ever left. An invitation whose email fails is undone, so the leader can retry.
  Calendar invitations are the exception: they go out in the background after publish, so their
  failures are only logged.
- **Drafts are the leader's private planning space.** Never expose them to members (this leaked
  once).
- **Visitors** (`ActivityGuest`) attend one activity without joining the group. They appear in the
  RSVP dashboard tagged as visitors, including those who haven't replied yet — a visitor with no
  RSVP row is synthesised into the list so an invitation is never invisible.

## Member experience

- Members see the **names of who's coming**, not the leader's roll call — and tapping one opens a
  direct thread with that person. Car-sharing is the case that asked for it: two people arranging a
  lift aren't a conversation the whole group should have to read, and the group chat buries it.
  Reachability is the rule, not the list: `assertReachable` in
  `backend/src/modules/directMessages/service.ts` allows a thread only between people who share a
  group or an activity, so an attendee list can't become a way to reach a stranger. There is no
  inbox — you go looking for a conversation through the person (see BACKLOG).
- **A face, or their initials — never a silhouette.** `User.avatarUrl` is a photo the user takes of
  themselves in Account; `Avatar` falls back to initials, because a roster of identical grey heads
  distinguishes people worse than the names already did.
- **Waze is a way to navigate, nothing more.** `User.navApp` (Account screen) picks what "Directions" opens; `navigationUrl` in `shared/src/utils` builds the link — Google uses the leader's saved URL, Waze is built from the stored coordinates. Planning, the leader's live position and the ETA stay on Google Maps (Waze has no routing API), so leaders still paste Google links.
- Members see the **whole route**, led by where to go now (see the itinerary decision above).
- Events awaiting a reply are **flagged on the event card** in their timeline.
- **Publishing an event invites everyone to it by email — nobody adds anything to a calendar.**
  The leader, the roster and visitors each get a calendar invitation
  (`backend/src/modules/calendar/invitations.ts`, file built by `buildIcsInvitation` in
  `shared/src/utils/calendar.ts`) that Gmail, Outlook and Apple Mail put on the calendar
  themselves. Editing a published event's title, description or time sends an update that moves
  the entry; deleting one that is still ahead sends a cancellation. This replaced "Add to
  calendar" buttons (portal event page, publish notification, event screen), which made a copy
  that never followed a reschedule — and having both would put the event on a calendar twice.
  Things that are deliberate:
  - **The sender is MeetingPnt with the leader's name on it**, and the organiser address must be
    the one the mail comes from. Sending as the leader would need access to their mail account.
  - **It asks for no reply.** RSVP stays in the app; the calendar's own Yes/No goes nowhere, and
    the email says so when the event takes RSVPs.
  - **One email per person, listing only them** — an invitation is not a way to read the roster.
  - **A series is ONE repeating entry** (`series-<id>`, the dates listed as `RDATE`), not an
    email per date. `Activity.invitedInstanceStart` is the start each date went out with, which
    is how a later change to a single date names it (`RECURRENCE-ID`).
  - **Sending never fails the action.** Emails go out in the background, spaced for Resend's rate
    limit; a failure is logged and the event is published regardless.
  - All-day trips are stored as local-midnight instants with no time zone, so the day is
    recovered by rounding (`compactDay`).
- **The subscription feed exists but is not the main road.** `User.calendarToken` and
  `/calendar/<token>.ics` (`backend/src/modules/calendar`) give each user a private link that
  Google, Apple or Outlook re-reads; it is offered only in mobile Account. It was on the portal's
  Activities page and event page and was taken off both — "subscribe to everything" answered a
  question nobody on an event page was asking. It leaves out drafts and cancelled events for the
  leader too, and anything the person declined. The token is the credential; "Reset link" revokes.
- **A member has one destination.** Their read-only view of a roster didn't earn a permanent tab,
  so mobile hides Groups for them and the tab bar goes away — the calendar is the app. Chat moved
  onto the event as a result, which is where a member's conversation nearly always belongs
  ("where are you", "I'm running late").

## Look and feel

The detailed rules, file locations and checklist live in the **`meetingpnt-ui`** skill. Three hold
for *any* work in this repo, so they stay here:

- **Neither client invents a colour.** Palette, scales and `STATUS_TONE` come from `shared/src/theme`;
  the portal mirrors them in `portal/src/index.css`. Use semantic names, not raw hexes.
- **Nothing interactive on mobile is below 44pt** (`minTouchTarget`).
- **Accent is reserved for where the group is now** — the live event, the current meeting point.

## Traps that have bitten

- **Metro does not resolve TypeScript's `.js` import convention.** `from './foo.js'` pointing at
  `foo.ts` typechecks fine and fails to bundle. Use extensionless relative imports in `mobile/`.
- **`tsc` passing does not mean mobile works.** Verify with `npx expo export --platform ios`,
  which exercises the real entry point and route tree.
- **Only import packages declared in `mobile/package.json`.** Transitive deps resolve for `tsc`
  (hoisted at the root) but not reliably for Metro.
- **Prisma engine lock:** `prisma generate` fails with `EPERM` while the backend dev server is
  running. Stop it first.
- **`npm install` while Metro is running kills Metro** — same shape as the Prisma lock above. The
  watcher crawls the workspace root, npm rewrites `node_modules` underneath it, and it dies on
  `ENOENT: watch ...` for a path that existed a moment earlier. Stop Metro, install, then
  `npx expo start -c`. `mobile/metro.config.js` now blocks the portal's `vite`/`esbuild` trees,
  which removes the most common trigger (esbuild leaves other platforms' binary folders lying
  around), but any install can still race the crawl.
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

**Jira is the base for all planned and deferred work** — project `MPNT` at
`meetingpnt.atlassian.net`. Look there for a ticket before starting something new and put its key
in the PR; file anything postponed there (what it does today, the gap, what it would take, and
when to build it) rather than in a file. `BACKLOG.md` is the earlier record, imported into Jira
and kept as history — the "see BACKLOG" pointers above lead to it. Don't add to it.
