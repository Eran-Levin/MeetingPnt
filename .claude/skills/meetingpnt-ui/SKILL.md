---
name: meetingpnt-ui
description: Use for cosmetic and presentation changes in MeetingPnt — colours, fonts, spacing, component or dropdown styling, layout, icons and illustrations, the amount or length of on-screen text — in the portal or the mobile app. No backend or database context needed. If the change adds or alters behaviour, stop and use meetingpnt-features.
---

# MeetingPnt UI

For changes to how things *look*, not what they *do*. You do not need the backend, Prisma or
deployment details for these — only the rules below.

## Stay in this skill only while the change is cosmetic

Cosmetic: colour, type, spacing, dropdown or button style, icon, illustration, rewording, trimming
or adding on-screen text, rearranging layout. **Not cosmetic** (hand over to `meetingpnt-features`):
new data, new endpoints, a feature moving between web and mobile, new behaviour on tap. Website
copy and the landing page's messaging belong to `meetingpnt-marketing`.

## Where things live

| What | Where |
|---|---|
| Palette, spacing and type scales, `STATUS_TONE` | `shared/src/theme` |
| The portal's mirror of those hexes | `@theme` in `portal/src/index.css` (the only portal file allowed to name a hex) |
| Portal components | `portal/src/components/ui` |
| Mobile components | `mobile/src/ui` (`Screen`, `Card`, `Button`, `Row`, `Chip`, `Badge`, `Section`, `Empty`) |
| Landing page art | `portal/src/components/landing/art.tsx` — SVG drawn with token classes (`fill-accent`, `stroke-line-strong`) |
| User-facing text | `shared/src/locales/en.ts` / `he.ts` — an edit needs both languages; typecheck enforces matching keys |

A palette change is a **two-file edit**: `shared/src/theme` and `portal/src/index.css`. Use semantic
names (`text-ink`, `bg-accent`, `bg-tone-danger-bg`), never raw `slate-500` / `blue-600` or a hex.

## Fast path

1. Branch from `master`.
2. Make the change.
3. Look at it: **phone width** first, then wide. Hebrew too whenever text or layout changed — the
   layout mirrors, so check direction-sensitive things (arrows, alignment, `start`/`end` spacing).
   Prefer measurements and text reads to eyeballing a cropped capture.
4. `npm run typecheck` (and `npm run build:shared` first if you touched `shared/`).
   Mobile changes: `npx expo export --platform ios` — `tsc` alone isn't enough.
5. PR; the Cloudflare bot comment carries the **Branch Preview URL** for the owner to look at.
   Portal changes need nothing else. A mobile change reaches phones only through
   `npm run update:mobile -- "message"` from `master` (reopen the app twice).
6. Merge only when the owner says so.

## Look and feel — the rules

- **Neither client invents a colour.** `shared/src/theme` holds the palette, the spacing and type
  scales, and `STATUS_TONE` — which maps every status to what it *means* (`declined` → danger,
  `in_progress` → accent). Clients pick a tone; the platform decides the pixels. Before this, the
  same concept drifted: a live event was a blue-tinted card on mobile and a pale blue pill on the
  web, with nothing saying which was right. Same argument as `formatActivityWhen`.
- **The portal mirrors the hexes** into `@theme` in `portal/src/index.css`, because CSS can't
  import the TypeScript tokens. That file is the only place in the portal allowed to name a hex,
  and everything downstream uses semantic utilities (`text-ink`, `bg-accent`, `bg-tone-danger-bg`)
  rather than `slate-500`/`blue-600`. A palette change is a two-file edit.
- **Nothing interactive on mobile is below 44pt** (`minTouchTarget`). This isn't box-ticking: the
  roll call is tapped outdoors, one-handed, in glare, with a group waiting, and it used to be a
  row of `Text` links.
- **Accent is reserved for where the group is now** — the live event, the current meeting point.
  Spend it anywhere else and it stops meaning anything.
- **One header, and it's ours.** The native stack header is off everywhere; `ScreenHeader` in
  `mobile/src/ui/Screen.tsx` draws the title, the back arrow and the account button. With both,
  every pushed screen said its name twice — small in the navigation bar, large in the page — and
  the page header is the one carrying the subtitle and the actions. It also owns the top safe-area
  inset: the screen scrolls under the notch, so without `insets.top` the title sits under the
  hardware and can't be read.
- **The account button is on every screen**, not just the one you land on. It's a bordered pill at
  the top right — face, first name, a small arrow — not a bare avatar: for a member it is the only
  way to Log out, and the bare circle wasn't seen as a button. It opens `app/account.tsx`, which is where the photo and Log out live. Signed-in
  identity used to be the calendar's top-right corner only, so a leader two screens into a group
  had no way to see who they were, let alone sign out.
- **Mobile composes from `mobile/src/ui`** (`Screen`, `Card`, `Button`, `Row`, `Chip`, `Badge`,
  `Section`, `Empty`); screen files should not be declaring their own colours or spacing. The
  portal's equivalents are `portal/src/components/ui`.
- **The running event is a bar, not a tab.** It docks above the tab bar and is present on every
  screen. A leader runs a few hours of live event a week, so a tab would sit empty the rest of the
  time — while "reachable the moment they log in" has to hold wherever they happen to be standing
  in the app, not only on the tab they last left selected.
- **Planning screens go wide** on the web (`<PageContainer wide>`): roster beside events on a
  group, itinerary beside replies on an event. Holding both in view is the reason to plan on a
  browser at all. Reading-width pages — login, a form — stay narrow.
- **Empty states name the space and say what would fill it**, rather than apologising ("Start your
  first group", not "No groups yet"). Most of these screens are empty on the day someone signs up.


## Before you hand it over

- No new colour, hex or ad-hoc spacing introduced; semantic tokens only.
- Nothing interactive on mobile under 44pt.
- Accent still means "where the group is now" and nothing else.
- Both languages read well and fit (Hebrew text is often longer or shorter than English).
- It still reads at phone width.
