/**
 * Time zones. A zone is an IANA name ("Asia/Jerusalem"). Start and end stay absolute instants — the
 * zone never changes *when* something happens, only where its day starts and ends and how the wall
 * clock reads. It is set at three levels, most specific winning: the event, its group, the leader.
 */

export const FALLBACK_TIME_ZONE = 'UTC';

/** Whether Intl knows this zone name. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The zone an event is run in: its own, else its group's, else the leader's. Every place that needs
 * one goes through this so the three levels can't be read in different orders.
 *
 * Null means nobody has set one yet (a leader from before zones existed who hasn't opened the
 * portal). Clients then render in the viewer's own zone, as they always did, rather than guessing.
 */
export function resolveTimeZone(levels: {
  activity?: string | null;
  group?: string | null;
  leader?: string | null;
}): string | null {
  return levels.activity || levels.group || levels.leader || null;
}

export function wallClock(instant: Date, timeZone: string) {
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

/**
 * The instant at which a zone's wall clock reads the given date and time. The wall time, read as if
 * it were UTC, is off from the real instant by the zone's offset — and the offset depends on which
 * instant we land on. Two passes settle it, since the first guess is at worst one DST change away.
 * `month` is 1-12.
 */
export function zonedTimeToInstant(
  wall: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timeZone: string,
): Date {
  const target = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour ?? 0,
    wall.minute ?? 0,
    wall.second ?? 0,
  );
  let guess = target - offsetMs(new Date(target), timeZone);
  guess = target - offsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

/**
 * Moves an instant by whole calendar days while keeping the wall-clock time in `timeZone`.
 *
 * Adding `days * 24h` would drift by an hour across a daylight-saving change — a 08:00 gathering
 * copied from September into November would land at 07:00 or 09:00. The server's own zone is no
 * help (Render runs UTC), so the zone comes from the event.
 */
export function shiftDays(instant: Date, days: number, timeZone: string): Date {
  if (days === 0) return instant;
  const wall = wallClock(instant, timeZone);
  const moved = zonedTimeToInstant({ ...wall, day: wall.day + days }, timeZone);
  return new Date(moved.getTime() + instant.getMilliseconds());
}

/** `YYYY-MM-DD` of an instant as the zone's calendar reads it. */
export function zonedDateKey(instant: Date, timeZone: string): string {
  const w = wallClock(instant, timeZone);
  return `${w.year}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
}

/** The browser's or device's own zone — the default a new leader starts with. */
export function deviceTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isValidTimeZone(zone) ? zone : FALLBACK_TIME_ZONE;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

/**
 * A date and time as the zone's clock reads it ("16 Jun 2026, 8:00 AM"). Without a zone — none set
 * anywhere yet — it reads in the viewer's own, as every screen did before zones existed.
 */
export function formatDateTime(iso: string | Date, locale?: string, timeZone?: string | null): string {
  return new Date(iso).toLocaleString(locale, timeZone ? { timeZone } : undefined);
}
