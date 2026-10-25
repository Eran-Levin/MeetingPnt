/**
 * Moves an instant by whole calendar days while keeping the wall-clock time in `timeZone`.
 *
 * Adding `days * 24h` would drift by an hour across a daylight-saving change — a 08:00 gathering
 * copied from September into November would land at 07:00 or 09:00. The server's own zone is no
 * help (Render runs UTC), so the leader's zone comes from their browser.
 */
export function shiftDays(instant: Date, days: number, timeZone: string): Date {
  if (days === 0) return instant;

  const wall = wallClock(instant, timeZone);
  const target = Date.UTC(wall.year, wall.month - 1, wall.day + days, wall.hour, wall.minute, wall.second);

  // The wall time we want, read as if it were UTC, is off from the real instant by the zone's
  // offset — and the offset itself depends on which instant we land on. Two passes settle it,
  // since the first guess is at worst one DST transition away.
  let guess = target - offsetMs(new Date(target), timeZone);
  guess = target - offsetMs(new Date(guess), timeZone);
  return new Date(guess + instant.getMilliseconds());
}

/** Throws RangeError for a zone name Intl doesn't know. */
export function assertTimeZone(timeZone: string): void {
  new Intl.DateTimeFormat('en-US', { timeZone });
}

function wallClock(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** How far the zone's wall clock is ahead of UTC at this instant. */
function offsetMs(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - (instant.getTime() - instant.getMilliseconds());
}
