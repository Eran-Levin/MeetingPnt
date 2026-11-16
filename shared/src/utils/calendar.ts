import type { Activity, MeetingPoint } from '../types/index.js';

/** One event as a calendar app wants it — the common shape behind every way of handing one over. */
export interface CalendarEvent {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: Date;
  endAt: Date;
  /** Date-only (a multi-day trip). Written as whole days so it sits in the all-day strip. */
  allDay?: boolean;
  updatedAt?: Date;
}

/**
 * An activity as a calendar entry: its group, what the leader wrote, and where it starts.
 * No labels, so nothing here needs translating.
 */
export function activityCalendarEvent(
  activity: Pick<
    Activity,
    'id' | 'title' | 'description' | 'startAt' | 'endAt' | 'allDay' | 'updatedAt'
  >,
  context: { groupName?: string | null; start?: Pick<MeetingPoint, 'label' | 'googleMapsUrl'> | null },
): CalendarEvent {
  return {
    uid: activity.id,
    title: activity.title,
    description: [context.groupName, activity.description, context.start?.googleMapsUrl]
      .filter(Boolean)
      .join('\n\n'),
    location: context.start?.label ?? null,
    startAt: new Date(activity.startAt),
    endAt: new Date(activity.endAt),
    allDay: activity.allDay,
    updatedAt: new Date(activity.updatedAt),
  };
}

function compactInstant(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * An all-day activity is stored as two instants — the leader's local midnight and 23:59:59 — and
 * no time zone, so the calendar day has to be recovered from the instant alone. Local midnight is
 * within twelve hours of the same date's UTC midnight almost everywhere, so pushing the instant
 * forward half a day and reading the UTC date gives the day the leader picked. (Wrong only east
 * of UTC+12.)
 */
function compactDay(instant: Date): string {
  return new Date(instant.getTime() + 12 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, '');
}

/** Start and end as calendar formats want them. The end of an all-day range is exclusive: one
 * second past 23:59:59 is the midnight that starts the day after. */
function span(event: CalendarEvent): { start: string; end: string } {
  return event.allDay
    ? { start: compactDay(event.startAt), end: compactDay(new Date(event.endAt.getTime() + 1000)) }
    : { start: compactInstant(event.startAt), end: compactInstant(event.endAt) };
}

/**
 * Google Calendar's "new event" page, filled in. Needs no file and no sign-in to us — and on
 * Android the Calendar app opens it directly, which is what makes it the phone's way in.
 */
export function googleCalendarEventUrl(event: CalendarEvent): string {
  const { start, end } = span(event);
  const params = [
    ['action', 'TEMPLATE'],
    ['text', event.title],
    ['dates', `${start}/${end}`],
    ...(event.description ? [['details', event.description]] : []),
    ...(event.location ? [['location', event.location]] : []),
  ];
  return `https://calendar.google.com/calendar/render?${params
    .map(([key, value]) => `${key}=${encodeURIComponent(value!)}`)
    .join('&')}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function octets(char: string): number {
  const code = char.codePointAt(0)!;
  return code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
}

/** RFC 5545 caps a line at 75 octets; longer ones continue on a line starting with a space.
 * Counted in UTF-8 bytes and split between characters, or a Hebrew title would be cut mid-letter. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = octets(char);
    // Continuation lines spend one octet on the leading space.
    if (bytes + size > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function eventLines(event: CalendarEvent, stamp: string): string[] {
  const { start, end } = span(event);
  const value = event.allDay ? ';VALUE=DATE' : '';
  return [
    'BEGIN:VEVENT',
    `UID:${event.uid}@meetingpnt.app`,
    `DTSTAMP:${stamp}`,
    ...(event.updatedAt ? [`LAST-MODIFIED:${compactInstant(event.updatedAt)}`] : []),
    `DTSTART${value}:${start}`,
    `DTEND${value}:${end}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    'END:VEVENT',
  ];
}

/**
 * An .ics file of any number of events — what Apple Calendar and Outlook take. With a `name` it is
 * a feed someone subscribes to: the name is what their calendar app lists it as, and the refresh
 * hints ask for an hourly re-read (a request, not a promise: Google keeps its own, slower, schedule).
 */
export function buildIcsCalendar(events: CalendarEvent[], name?: string): string {
  const stamp = compactInstant(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MeetingPnt//EN',
    'CALSCALE:GREGORIAN',
    ...(name
      ? [
          'METHOD:PUBLISH',
          `X-WR-CALNAME:${escapeIcsText(name)}`,
          'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
          'X-PUBLISHED-TTL:PT1H',
        ]
      : []),
    ...events.flatMap((event) => eventLines(event, stamp)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
