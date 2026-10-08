export function isBeforeStartTime(startAt: string, now: Date = new Date()): boolean {
  return now.getTime() < new Date(startAt).getTime();
}

/**
 * Whether the leader is sharing a live position right now.
 *
 * `leaderBroadcastUntil` is a lease, so a non-null value is not the same as "broadcasting" — it
 * expires on its own and nothing rewrites it at that moment. Both clients and the server decide
 * through this one function so they can't disagree about when a broadcast has lapsed.
 */
export function isLeaderBroadcasting(
  leaderBroadcastUntil: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!leaderBroadcastUntil) return false;
  return new Date(leaderBroadcastUntil).getTime() > now.getTime();
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Renders an activity's span the way a leader would say it out loud, in the viewer's locale:
 *
 *   timed, one day   -> "16 Jun, 6:00 PM – 9:00 PM"
 *   timed, overnight -> "16 Jun, 11:00 PM – 17 Jun, 2:00 AM"
 *   all-day, one day -> "18 Jul"
 *   all-day, range   -> "18 Jul – 25 Jul"
 *
 * Shared so the portal and mobile never drift apart on this.
 */
export function formatActivityWhen(
  startAt: string,
  endAt: string,
  allDay: boolean,
  locale?: string,
): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const dateOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

  const startDate = start.toLocaleDateString(locale, dateOpts);
  const endDate = end.toLocaleDateString(locale, dateOpts);

  if (allDay) {
    return isSameCalendarDay(start, end) ? startDate : `${startDate} – ${endDate}`;
  }

  const startTime = start.toLocaleTimeString(locale, timeOpts);
  const endTime = end.toLocaleTimeString(locale, timeOpts);

  return isSameCalendarDay(start, end)
    ? `${startDate}, ${startTime} – ${endTime}`
    : `${startDate}, ${startTime} – ${endDate}, ${endTime}`;
}

const FSI = '⁨'; // first-strong isolate
const PDI = '⁩'; // pop directional isolate

/**
 * Wraps text someone typed — a group, event or place name — so it keeps its own direction inside
 * a sentence built by us. Without it, an English place name in a Hebrew line drags the "·"
 * separators and any numbers beside it to the wrong side. Names are stored and shown verbatim;
 * this only fences them off. In JSX on the web, `<bdi>` does the same job.
 */
export function isolate(text: string): string {
  return text ? `${FSI}${text}${PDI}` : text;
}

/** Joins display fragments with a middle dot, isolating each so mixed-language parts can't
 * reorder the separators. Empty parts are dropped. */
export function joinDot(parts: Array<string | null | undefined | false>): string {
  return parts.filter((p): p is string => Boolean(p)).map(isolate).join('  ·  ');
}

/**
 * The weekday on a calendar block: "THU" in English, "ה׳" in Hebrew. Hebrew's short form is two
 * words ("יום ה׳"), which doesn't fit a block that is meant to be glanced at, so it uses the
 * narrow one.
 */
export function formatWeekdayShort(date: Date, locale?: string): string {
  const width = locale?.startsWith('he') ? 'narrow' : 'short';
  return date.toLocaleDateString(locale, { weekday: width }).toUpperCase();
}
