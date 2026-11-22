import { FALLBACK_TIME_ZONE, wallClock, zonedTimeToInstant } from './timeZone.js';

type Stored = 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled';

export interface StatusInput {
  /** What is stored. Only draft, published and cancelled are ever written now. */
  status: Stored;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  /** "Start now": the leader opened the event before its time. */
  startedAt: Date | null;
  /** "End activity": the leader closed it before it would have closed itself. */
  endedAt: Date | null;
  /** The event's own zone, or null when nobody has set one (then UTC is used to find day ends). */
  timeZone: string | null;
  /** Where the group first meets. Only read for all-day events, which have no clock start. */
  firstStopAt?: Date | null;
  /** When the next day of the same multi-day event begins, if there is one. */
  nextDayStartAt?: Date | null;
}

/**
 * When the event is taken to begin: the moment the leader pressed "Start now", else the scheduled
 * start. An all-day event has no clock start, so it begins at its first planned stop (when that
 * falls on its day) and otherwise at the start of the day.
 */
export function effectiveStart(input: StatusInput): Date {
  if (input.startedAt) return input.startedAt;
  const stop = input.firstStopAt;
  if (input.allDay && stop && stop >= input.startAt && stop <= input.endAt) return stop;
  return input.startAt;
}

/**
 * When the event is taken to end: the leader's "End activity" if they pressed it; otherwise the
 * start of the next day of the same multi-day event (so location sharing never lapses overnight on
 * a trek); otherwise the end of the day it was scheduled to finish on, which is what spares leaders
 * from having to remember to close anything. An event in another group never ends this one.
 */
export function effectiveEnd(input: StatusInput): Date {
  if (input.endedAt) return input.endedAt;
  const zone = input.timeZone || FALLBACK_TIME_ZONE;
  // One millisecond back, so an event finishing exactly at midnight belongs to the day it ran on.
  const wall = wallClock(new Date(input.endAt.getTime() - 1), zone);
  const dayEnd = zonedTimeToInstant({ ...wall, day: wall.day + 1, hour: 0, minute: 0, second: 0 }, zone);
  // A day with another day after it runs until that one begins, however late that is: the gap
  // between an evening's end and the next morning's start is when a guide most needs to find
  // someone. Only the last day of a trip (or an event on its own) closes at the end of its day.
  const next = input.nextDayStartAt;
  return next && next > effectiveStart(input) ? next : dayEnd;
}

/**
 * What an event is right now. Drafts and cancelled events are what they were saved as; everything
 * else follows the clock, so nobody has to press Start or End for an event to be running or over.
 * Derived on every read and never written back.
 */
export function effectiveStatus(input: StatusInput, now: Date = new Date()): Stored {
  if (input.status === 'draft' || input.status === 'cancelled') return input.status;
  if (input.endedAt && now >= input.endedAt) return 'completed';
  if (now < effectiveStart(input)) return 'published';
  return now < effectiveEnd(input) ? 'in_progress' : 'completed';
}
