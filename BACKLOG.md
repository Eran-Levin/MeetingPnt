# Backlog — deferred work

Things consciously left undone, with the reasoning. This is not a wishlist: each item
was either explicitly deprioritised in conversation, or is a known gap in something
already shipped. Delete an entry when it lands.

Last reviewed: 2026-08-05

## Deployed — and what it left open

**Live since Wed 5 August 2026**, all on free tiers: portal `app.meetingpnt.com` (Cloudflare
Workers static assets), API `api.meetingpnt.com` (Render, Docker), Neon Postgres with PostGIS,
Android via EAS internal distribution. `DEPLOYMENT.md` is the cookbook for redeploying.

This is a **test deployment, not a launch.** Security was consciously postponed, so the four
pre-deployment items resolved like this:

1. **The `sameSite: 'strict'` refresh cookie turned out not to need changing.** The prediction was
   that it would break across domains; it doesn't, because `app.meetingpnt.com` and
   `api.meetingpnt.com` share a registrable domain and the browser treats them as same-site.
   Still only verified as far as login — **the refresh at the 15-minute access-token expiry has
   never been exercised against the deployment.** If portal sessions die after ~15 minutes, this
   is the entry to reopen.
2. **Chat images are still on local disk** — see the storage entry below. Render's filesystem is
   ephemeral, so uploaded images now disappear on every deploy. This is the one deferred item that
   loses data rather than merely risking it.
3. **No rate limiting.** Login, invitation-token acceptance, and registration are all reachable
   from the public internet and brute-forceable.
4. **Secrets are half done.** `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` hold real generated values
   in Render. But **the seed was run against the deployed database**, against this file's own
   advice — so `password123` accounts and a known-password admin are live on a public URL. Wiping
   them is the first thing to do before anyone real touches this.

Also live and unaddressed: no CSP tuned for the app, no upload MIME validation, `/uploads` served
with CORP relaxed and protected only by unguessable filenames, and real location data sitting in a
free-tier database with no backups configured.

**Push notifications are wired but unverified.** FCM V1 credentials are attached to the EAS project
and the APK is built from them; nobody has yet confirmed a ping actually reaches a device.

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
deliberate seam in `lib/storage.ts`. This is no longer hypothetical: Render's filesystem is
ephemeral, so every deploy and every wake from idle now discards the images uploaded before it.
Cloudflare R2's free tier is 10 GB and S3-compatible; swapping to it should only touch that
one file.

**`BACKEND_PUBLIC_URL` was a hardcoded LAN IP in local `.env`.** Resolved for the deployment —
Render sets it to `https://api.meetingpnt.com`. The local `.env` still holds a machine-specific
LAN address for phone testing, which is correct there and wrong everywhere else.

## Known gaps in shipped features

**Members aren't told when the leader moves the group.** Adding a meeting point mid-event updates
the app silently — a member only sees the new point when they next open or refresh the screen. The
push plumbing already exists (`sendPushNotifications`), so this is a small addition; it was
explicitly deferred as "not now". Until it lands, moving the group depends on the leader also
saying so in chat.

**Push notifications are unverified.** The receive path has never actually been exercised — only
the send path. The blocker used to be Expo Go dropping remote push in SDK 53; that's now gone,
since an internal-distribution APK with FCM V1 credentials exists (see the deployment section).
What remains is simply doing it: install on a real device, grant the notification permission, and
have a leader ping a member. Until then "leader pings a member" is only half-proven.

**Let the leader send an invitation over WhatsApp themselves.** An invitation is a personal act —
"come join my photo walk" — and it lands better from someone you know than from an email or a
business number. A `wa.me/<phone>?text=<invite link>` link opens WhatsApp with the message
composed on the leader's own device; they press send. No API, no business account, no templates,
no per-message cost, and none of the opt-in machinery below, because Meta's consent rules govern
*business* messaging, not one person messaging their own contact. The phone number is already
collected at invite time, so the data is there. The same trick gives `sms:` as a fallback.

Two things to get right. `wa.me` wants E.164 digits only and phones are stored loosely
(`+972 54-964-5964` → `972549645964`), so they need normalising. And the invite endpoint would
have to return the accept link to the leader, which softens the current posture of the raw token
existing only inside the email — defensible, since the leader created the invitation and is
authenticated, but it's a decision rather than something to drift into.

Only covers invitations. Anything recurring or automated still needs push or the business API.

**Invitation links don't yet open the app directly.** The link is now an ordinary https page
(fixed 2 Aug 2026 — it used to be a bare `meetingpnt://` scheme that did nothing for anyone
without the app, which is most people receiving an invitation). The page explains the invitation
and offers a button into the app, but that button is still a custom scheme: it works if the app
is installed and silently does nothing if not, and the page can't tell which. Proper Universal
Links (iOS) and App Links (Android) would make the https URL open the app directly, and need
`apple-app-site-association` / `assetlinks.json` served from the real domain plus the app's
bundle identifiers — so this waits on both the deployment and app distribution. The page also
says "install MeetingPnt" without linking anywhere, because there's no store listing yet; that
becomes a real button when there is one.

**WhatsApp as a notification channel — open question, nothing decided.** Raised on 2 Aug 2026.
Worth keeping distinct from the original plan's rejection of WhatsApp, which was about *chat*:
the Business API genuinely cannot create or manage group chats, and that hasn't changed. Sending
1:1 templated notifications is a different capability and is available.

It suits some of what we send and not others. The four things that notify today are activity
published, series published, new chat message, and the leader's location ping. The first two are
a good fit — low volume, high value, and a plain utility template. Chat is a bad fit: per-message
cost, high volume, and a reply goes nowhere because the member can't answer into the group. The
ping degrades — today's push carries a data payload so the member answers with their location
from the notification itself, and WhatsApp can only offer a link back into the app. (Inbound
WhatsApp *can* carry a location share, which would in principle let someone take part without
installing the app at all. Intriguing, unproven, a lot of machinery.)

The prerequisite is consent, and we don't have it. Meta requires demonstrable opt-in before you
message anyone, and phone numbers arrive here typed in by the *leader* at invite time — which is
not the member agreeing to be messaged by us. A real opt-in, captured at sign-up or first login
and stored with a timestamp, has to come first. Easy to skip, expensive to discover late.

Also needed: a verified Meta Business account (unverified ones are capped at a low number of
unique recipients per day), a dedicated number not already on regular WhatsApp, and per-template
Meta review of every message's wording. Pricing is per conversation/message and varies by country
and template category; Meta has been changing it, so check current docs rather than any figure
quoted from memory. Webhooks need a public HTTPS endpoint, so this can't sensibly be built
against localhost — it comes after the deployment above.

On sequencing: prove push first (the entry above — its receive path has still never run).
Standing up a second channel while the first is unverified means debugging two unproven paths at
once. If it still looks worthwhile after that, the shape worth trying is WhatsApp for the
scheduling notifications only and push for anything tied to a live event. Either way the first
code change is the same: the four call sites each invoke `sendPushNotifications` directly, and a
thin `notify(userId, event)` layer that fans out per channel and per user preference belongs in
between before any second channel is threaded through them.

**Direct messages have no inbox, and no unread state.** You reach a one-to-one thread through a
person — a name in the attendee list, a row on the roster — and there is nowhere that lists your
conversations or tells you one has a new message in it. Deliberate for now: an inbox needs a home,
and a member's tab bar was removed on purpose (they have one destination, the calendar). The push
notification is what tells someone a message arrived, and tapping it currently opens the app
rather than the thread — `pingHandler` routes `location_ping` and `leader_location_request` and
ignores `direct_message`. Deep-linking that is the smallest useful next step; an inbox only earns
its place once people are running more than one or two threads.

**Replacing a profile photo orphans the old file.** `PUT /users/me/avatar` writes a new file and
repoints the row; nothing deletes what it replaced. Losing a photo to a failed write is worse than
an orphan, so the sweep belongs with the BullMQ jobs above — and with the storage move, since on
Render today those files don't survive a deploy anyway.

**The portal shows names where mobile now shows faces.** `avatarUrl` is on every user the API
returns, including the portal's roster and RSVP dashboard, and the portal ignores it. Capture is
a phone thing — camera, in the moment — so the upload was built mobile-only; rendering the photo
on the web is display-only work whenever it's wanted.

**Chat history has no pagination UI.** The backend serves 50 messages a page and accepts
a `before` cursor, but neither client passes it. Groups will silently cap at the most
recent 50 messages with no way to scroll back. Direct threads inherited exactly the same gap.

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
