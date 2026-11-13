export interface IcsEventInput {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  startAt: Date;
  endAt: Date;
  /** Date-only (a multi-day trip). Written as whole days so it sits in the all-day strip. */
  allDay?: boolean;
  updatedAt?: Date;
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * An all-day activity is stored as two instants — the leader's local midnight and 23:59:59 — and
 * no time zone, so the calendar day has to be recovered from the instant alone. Local midnight is
 * within twelve hours of the same date's UTC midnight almost everywhere, so pushing the instant
 * forward half a day and reading the UTC date gives the day the leader picked. (Wrong only east
 * of UTC+12.)
 */
function formatIcsDay(instant: Date): string {
  return new Date(instant.getTime() + 12 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, '');
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 caps a line at 75 octets; longer ones continue on a line starting with a space.
 * Counted in bytes and split between characters, or a Hebrew title would be cut mid-letter. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char);
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

function eventLines(input: IcsEventInput, stamp: string): string[] {
  const when = input.allDay
    ? [
        `DTSTART;VALUE=DATE:${formatIcsDay(input.startAt)}`,
        // DTEND is exclusive: one second past 23:59:59 is the midnight that starts the day after.
        `DTEND;VALUE=DATE:${formatIcsDay(new Date(input.endAt.getTime() + 1000))}`,
      ]
    : [`DTSTART:${formatIcsDate(input.startAt)}`, `DTEND:${formatIcsDate(input.endAt)}`];

  return [
    'BEGIN:VEVENT',
    `UID:${input.uid}@meetingpnt.app`,
    `DTSTAMP:${stamp}`,
    ...(input.updatedAt ? [`LAST-MODIFIED:${formatIcsDate(input.updatedAt)}`] : []),
    ...when,
    `SUMMARY:${escapeIcsText(input.title)}`,
    ...(input.description ? [`DESCRIPTION:${escapeIcsText(input.description)}`] : []),
    ...(input.location ? [`LOCATION:${escapeIcsText(input.location)}`] : []),
    ...(input.url ? [`URL:${input.url}`] : []),
    'END:VEVENT',
  ];
}

/**
 * A calendar of any number of events. With a `name` it is a feed someone subscribes to — the name
 * is what their calendar app lists it as, and the refresh hints ask for an hourly re-read (a
 * request, not a promise: Google in particular keeps its own, slower, schedule).
 */
export function buildIcsCalendar(events: IcsEventInput[], name?: string): string {
  const stamp = formatIcsDate(new Date());
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
