# Backlog — deferred work

Things consciously left undone, with the reasoning. This is not a wishlist: each item
was either explicitly deprioritised in conversation, or is a known gap in something
already shipped. Delete an entry when it lands.

Last reviewed: 2026-08-02

## Scheduled

**First deployment — targeted for the week of Mon 3 August 2026.** Everything still runs on one
laptop; testing on a phone needs the same Wi-Fi. Getting it hosted is the next piece of work,
ahead of any new features.

Four code changes are needed first, and none of them depend on which host is chosen:

1. **The refresh cookie is `sameSite: 'strict'`** (`backend/src/modules/auth/routes.ts`). Harmless
   while the portal and API share `localhost`. Once they're on different domains the browser stops
   sending it, so every session dies at the 15-minute access-token expiry with no way to refresh.
   Needs `sameSite: 'none'` + `secure: true` under `NODE_ENV=production` — or serve the portal from
   the API's own domain, which sidesteps this and the CORS config together.
2. **Move chat images off local disk** — see the storage entry below. Ephemeral filesystems are the
   norm on managed hosts, so images would disappear on every deploy.
3. **Rate limiting on auth**, at minimum on login. Listed below; it stops being theoretical the
   moment there's a public URL.
4. **Production secrets.** `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` need real values, and the
   seed must never run against a deployed database — it creates an admin with a known password and
   fifteen users on `password123`.

**PostGIS is the constraint when choosing a host.** Meeting points and location snapshots are
`geography(Point,4326)` columns; a managed Postgres without the extension simply won't run the
migrations. Verify it before committing to a provider rather than after.

Leaning towards a managed platform for the backend with the portal served from the same domain,
and EAS Build with internal distribution for mobile — which would also be the first real test of
push notifications, still unverified (below).

## Blocking a production launch

**No automated tests anywhere.** No test script, runner, or test files in any workspace.
Every verification so far has been manual (browser automation, `expo export`, curl).
The riskiest untested logic is `generateOccurrenceDates` (recurrence maths, easy to get
subtly wrong across DST and month boundaries) and `parseGoogleMapsUrl` (many URL shapes).
Both are pure functions and cheap to unit test — start there.

**Phase 7 hardening never happened.** The original plan's final phase is entirely
unbuilt: BullMQ is a dependency but there are no jobs and no `backend/src/jobs/`
directory. That means no RSVP/activity reminder pushes, no invitation expiry sweep, and
**no retention purge for `location_snapshots`** — the privacy-first design assumed old
location points get deleted, and today they accumulate forever. There is also no rate
limiting on any endpoint, including login.

**Nothing closes an event that's simply been forgotten.** Starting an event now ends whichever one
was already running in that group, which is what makes a multi-day trip continuous and stops a
leader accumulating live events. But it only tidies up when there *is* a next start: a leader who
runs one event and never starts another leaves it `in_progress` indefinitely, and with it the
location-sharing channel. For a design whose whole premise is discrete, consented location
snapshots, "open forever because nobody pressed End" is the wrong resting state. The fix is a
time-based sweep closing anything still running well past its `endAt`, which belongs with the
BullMQ jobs below — the two should land together.

**Copying a roster between trips.** A trip is a group, so a guide running the same route in
September and November creates two groups and re-invites the same people by hand. Deliberately
deferred until someone has actually run a second trip and felt it; the shortcut is obvious
("start from the roster of…") but the right shape isn't obvious until then.

**Audit log only records role changes.** `auditLog.create` is called in exactly one
place (`admin/service.ts`). Group deletion, activity cancellation, and attendance edits
— the actions a leader would most plausibly need to account for — leave no trace.

**Chat image storage is local disk.** `saveImage` writes to `backend/uploads/` behind a
deliberate seam in `lib/storage.ts`. Fine for a single dev box; it breaks the moment the
backend runs more than one instance or a container restarts. Swapping to S3-compatible
storage should only touch that one file.

**`BACKEND_PUBLIC_URL` is a hardcoded LAN IP in local `.env`.** Set to `192.168.7.101`
so chat image URLs resolve on a physical phone. That address is specific to one machine
and one Wi-Fi network — it will silently serve broken image links for anyone else, and
in any deployment. Needs to come from proper per-environment config.

## Known gaps in shipped features

**Members aren't told when the leader moves the group.** Adding a meeting point mid-event updates
the app silently — a member only sees the new point when they next open or refresh the screen. The
push plumbing already exists (`sendPushNotifications`), so this is a small addition; it was
explicitly deferred as "not now". Until it lands, moving the group depends on the leader also
saying so in chat.

**Push notifications are unverified.** Expo Go dropped remote push in SDK 53, so the
receive path has never actually been exercised — only the send path. Testing needs a
development build (`npx expo run:android`). Deprioritised deliberately, but it means
"leader pings a member" is only half-proven.

**Chat history has no pagination UI.** The backend serves 50 messages a page and accepts
a `before` cursor, but neither client passes it. Groups will silently cap at the most
recent 50 messages with no way to scroll back.

**No analysis section on the Web.** The groups list now separates Active from Closed, and the
intent was a third, separate analysis area alongside them. Closed groups are where a leader
would go looking for it, so that is the natural home for the reporting described below.

**No post-event analysis view on the Web.** Attendance is now recorded per meeting point
and the API exposes both the per-point breakdown (`GET /activities/:id/attendance`) and a
derived rollup (`GET /activities/:id/participation`), but there is no reporting screen over
them. Three things were asked for and deferred: a per-meeting-point breakdown for one event,
**attendance across a whole series** (the yoga billing question — "who attended how many of
the 8 classes" currently means opening 8 pages and tallying), a meeting-point timeline as a
record of how an event unfolded, and CSV export. The series-level view is the valuable one;
the data is already there, it just needs a screen.

**Recurring series can only be bulk-published, not bulk-edited.** Occurrences are
independent rows, so changing the time of a whole series means editing each one by hand.
Fine at 3 occurrences, painful at 20 — the yoga instructor's twice-weekly term is 8+.
Now sharper than it was: a trip's days are separate events, so a departure slipping by a day
means re-dating every day of the trek one at a time. A "shift the whole thing by N days" action
would cover both cases.

**"Approve attendance" has no per-leader default.** The checkbox is set per event and starts on
every time, which is right for a photo club and wrong for a tour guide — they turn it off for
every day of every trip and only want it on for the pre-trip gathering. The default should come
from the leader's own preference (or be inferred from what they last chose), so the common case
stops needing a click. Deliberately not guessed at now: one leader-level setting, a per-group
default, and "remember the last choice" are all plausible, and which is right depends on whether
a leader's habits are consistent across their groups — which nobody knows yet.

**`chatMode` is portal-only.** Mobile correctly honours it (members see a read-only
composer in `announcements` mode) but leaders can't change the setting from their phone.

**Attendance is manual roll-call only.** Auto-marking present from OMW/location proximity
was considered and rejected for v1 — GPS drift and "checked in then left" make it
misfire. Revisit only if manual roll-call proves too tedious in practice.

**Places search / pin-drop was never built.** Phase 6 assumed picking meeting points from
a map. What shipped instead is Google Maps URL parsing, which covers the same need more
simply. Worth reconsidering only if pasting links proves awkward on mobile.

## Tech debt

**The monorepo spans two React majors.** Mobile is on React 19 (forced by Expo SDK 54);
the portal is still on 18. npm hoists 19 to the root, so `portal/tsconfig.json` needs
explicit `paths` pinning React types to its own nested copy — without them every JSX
element fails to typecheck. Upgrading the portal to 19 would delete that workaround.
Deferred because the portal was mid-testing and its dependencies (react-router v7,
TanStack Query v5, vis.gl) all support 19 already, so it should be uneventful.

**Mobile UI is unstyled relative to the portal.** The portal got a full Tailwind
redesign; mobile is still raw `StyleSheet` from the original scaffold. Explicitly scoped
to "portal only" at the time.

**36 npm audit vulnerabilities**, all in dev-tooling transitives (sucrase, esbuild,
postcss) rather than shipped runtime code. Worth a pass but not urgent.
