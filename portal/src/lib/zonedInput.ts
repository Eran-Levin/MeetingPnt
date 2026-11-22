import { zonedTimeToInstant, wallClock } from '@meetingpnt/shared';

/**
 * Date and time inputs hold a wall clock, with no zone of their own. For a leader planning a tour in
 * Denver from Tel Aviv, "08:00" means Denver's 08:00 — so the wall clock is read and written in the
 * event's zone, not the browser's. With no zone set anywhere yet it falls back to the browser's,
 * which is how every event was entered before zones existed.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of an instant in the zone's calendar. */
export function dateInput(iso: string, timeZone: string | null): string {
  const d = new Date(iso);
  if (!timeZone) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const w = wallClock(d, timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** `HH:MM` of an instant on the zone's clock. */
export function timeInput(iso: string, timeZone: string | null): string {
  const d = new Date(iso);
  if (!timeZone) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const w = wallClock(d, timeZone);
  return `${pad(w.hour)}:${pad(w.minute)}`;
}

/**
 * The instant at which the zone's clock reads `date` (`YYYY-MM-DD`) and `time` (`HH:MM`, or with
 * seconds). The reverse of `dateInput` + `timeInput`.
 */
export function inputToInstant(date: string, time: string, timeZone: string | null): Date {
  if (!timeZone) return new Date(`${date}T${time}`);
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second] = time.split(':').map(Number);
  return zonedTimeToInstant(
    { year: year!, month: month!, day: day!, hour: hour ?? 0, minute: minute ?? 0, second: second ?? 0 },
    timeZone,
  );
}
