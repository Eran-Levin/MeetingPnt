import type {
  Activity,
  MeetingPoint,
  MeetingPointTemplateDto,
  TransportMode,
} from '@meetingpnt/shared';
import { dateInput, timeInput } from './zonedInput.js';

/** What the create form needs, in the shapes its inputs hold (date and time as strings). */
export interface ActivityCopy {
  title: string;
  description: string;
  allDay: boolean;
  transportMode: TransportMode;
  requiresRsvp: boolean;
  singleLocation: boolean;
  date: string;
  startTime: string;
  endTime: string;
  endDate: string;
  meetingPoints: MeetingPointTemplateDto[];
  /** True when stops were dropped or pulled in to fit what a new activity can hold. */
  trimmed: boolean;
}

// What createActivitySchema accepts: five stops, each within a day of the start.
const MAX_STOPS = 5;
const MAX_OFFSET_MINUTES = 1440;


/** `YYYY-MM-DD` plus whole days, done in UTC so a daylight-saving change can't shift the date. */
function addDays(isoDate: string, days: number): string {
  const [y = 0, m = 1, d = 1] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Whole calendar days from one `YYYY-MM-DD` to another. */
function daysBetween(from: string, to: string): number {
  const [fy = 0, fm = 1, fd = 1] = from.split('-').map(Number);
  const [ty = 0, tm = 1, td = 1] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/**
 * Turns an existing activity into a starting point for a new one on `newDate`. Everything about
 * the shape carries over; only the dates move. Stops are stored as absolute times but created from
 * offsets to the start, so each one keeps its distance from the start and lands on the new day.
 * Nothing about how the first one ran (RSVPs, attendance, status) comes along, and neither does a
 * recurrence — copying one occurrence of a series gives one draft.
 */
export function copyActivity(
  source: Activity,
  points: MeetingPoint[],
  newDate: string,
): ActivityCopy {
  const start = new Date(source.startAt);
  const end = new Date(source.endAt);

  const kept = source.singleLocation ? points.slice(0, 1) : points.slice(0, MAX_STOPS);
  let trimmed = kept.length < points.length && !source.singleLocation;

  const meetingPoints = kept.map((mp) => {
    const offset = Math.round((new Date(mp.time).getTime() - start.getTime()) / 60_000);
    const clamped = Math.max(-MAX_OFFSET_MINUTES, Math.min(MAX_OFFSET_MINUTES, offset));
    if (clamped !== offset) trimmed = true;
    return {
      label: mp.label ?? undefined,
      googleMapsUrl: mp.googleMapsUrl,
      offsetMinutes: clamped,
    };
  });

  return {
    title: source.title,
    description: source.description ?? '',
    allDay: source.allDay,
    transportMode: source.transportMode,
    requiresRsvp: source.requiresRsvp,
    singleLocation: source.singleLocation,
    date: newDate,
    // Read on the source's own clock: the form reads these on the new event's clock, so an 08:00
    // start stays 08:00 wherever it is.
    startTime: timeInput(source.startAt, source.effectiveTimeZone),
    endTime: timeInput(source.endAt, source.effectiveTimeZone),
    // A trip keeps its length: the same number of days after the new start.
    endDate: addDays(
      newDate,
      source.allDay
        ? daysBetween(
            dateInput(source.startAt, source.effectiveTimeZone),
            dateInput(source.endAt, source.effectiveTimeZone),
          )
        : 0,
    ),
    meetingPoints,
    trimmed,
  };
}
