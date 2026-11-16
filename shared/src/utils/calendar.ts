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

function eventLines(event: CalendarEvent, stamp: string, extra: string[] = []): string[] {
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
    ...extra,
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

/** A parameter value (a person's name) — quoted, so a comma or colon in it can't end the value. */
function quoteParam(value: string): string {
  return `"${value.replace(/["\r\n]/g, ' ')}"`;
}

export interface CalendarInvitation {
  /** `request` puts the event on the calendar or moves it; `cancel` takes it off. */
  method: 'request' | 'cancel';
  event: CalendarEvent;
  /**
   * What makes a calendar accept a change: it ignores anything not newer than what it holds. Must
   * only ever grow for one `uid`.
   */
  sequence: number;
  /** Who the calendar shows as having sent it. The address has to be the one the email comes from. */
  organizer: { name: string; email: string };
  /** The one person this copy is for. Nobody else is listed — a roster is not theirs to read. */
  attendee: { name: string; email: string };
  /**
   * The other dates of a series, making this one repeating entry rather than twenty invitations.
   * Listed outright, not as a weekly rule: the occurrences are stored as separate events and a rule
   * would have to guess a time zone the server doesn't know.
   */
  moreStarts?: Date[];
  /** Which date of a series this is about — the start it was invited with. Without it, a change
   * means the whole series. */
  instanceStart?: Date;
}

/**
 * A calendar invitation, as the file an email carries. Gmail, Outlook and Apple Mail read it and
 * put the event on the calendar themselves; sending the same `uid` again with a higher `sequence`
 * moves it, and `cancel` removes it.
 *
 * It asks for no reply (`RSVP=FALSE`): whether someone is coming is answered in the app, and a
 * calendar's own Yes/No would go to an address nobody reads.
 */
export function buildIcsInvitation(invitation: CalendarInvitation): string {
  const { event, organizer, attendee } = invitation;
  const cancel = invitation.method === 'cancel';
  const value = event.allDay ? ';VALUE=DATE' : '';
  const day = event.allDay ? compactDay : compactInstant;
  const extra = [
    `SEQUENCE:${invitation.sequence}`,
    `STATUS:${cancel ? 'CANCELLED' : 'CONFIRMED'}`,
    `ORGANIZER;CN=${quoteParam(organizer.name)}:mailto:${organizer.email}`,
    `ATTENDEE;CN=${quoteParam(attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${attendee.email}`,
    ...(invitation.moreStarts?.length
      ? [`RDATE${value}:${invitation.moreStarts.map(day).join(',')}`]
      : []),
    ...(invitation.instanceStart ? [`RECURRENCE-ID${value}:${day(invitation.instanceStart)}`] : []),
  ];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MeetingPnt//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${cancel ? 'CANCEL' : 'REQUEST'}`,
    ...eventLines(event, compactInstant(new Date()), extra),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
