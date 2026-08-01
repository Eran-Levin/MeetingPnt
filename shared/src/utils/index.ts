export function isBeforeStartTime(startAt: string, now: Date = new Date()): boolean {
  return now.getTime() < new Date(startAt).getTime();
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
