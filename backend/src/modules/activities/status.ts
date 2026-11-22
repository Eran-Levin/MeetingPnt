import {
  effectiveStatus,
  resolveTimeZone,
  type Activity as SharedActivity,
} from '@meetingpnt/shared';
import type { Activity } from '@prisma/client';
import { getMeetingPointById, listFirstStops, type MeetingPointRow } from '../../db/geo.js';
import { prisma } from '../../db/prisma.js';

/**
 * What an event is right now is worked out here, from the clock, and nowhere else — every gate and
 * every API response goes through `statusOf` so they cannot disagree. The rules themselves are
 * `effectiveStatus` in shared; this module gathers what they need to know about each event (its
 * zone, its first stop, the next day of its trip) in a handful of queries, however many events.
 */

/** The two inherited levels of an event's time zone: its group's own, and its leader's default. */
export type InheritedZones = { group: string | null; leader: string | null };

export interface StatusContext {
  zones: Map<string, InheritedZones>;
  firstStops: Map<string, { id: string; time: Date }>;
  /** When the next day of the same multi-day event begins, by activity. */
  nextDayStart: Map<string, Date>;
}

/** One query for the zones of every group in a result, so a list stays a single round trip. */
export async function loadInheritedZones(groupIds: string[]): Promise<Map<string, InheritedZones>> {
  const groups = await prisma.group.findMany({
    where: { id: { in: [...new Set(groupIds)] } },
    select: { id: true, timeZone: true, leader: { select: { timeZone: true } } },
  });
  return new Map(groups.map((g) => [g.id, { group: g.timeZone, leader: g.leader.timeZone }]));
}

export async function loadStatusContext(activities: Activity[]): Promise<StatusContext> {
  const eventIds = [
    ...new Set(activities.map((a) => a.multiDayEventId).filter((id): id is string => id !== null)),
  ];
  const [zones, stops, siblings] = await Promise.all([
    loadInheritedZones(activities.map((a) => a.groupId)),
    listFirstStops(activities.map((a) => a.id)),
    eventIds.length
      ? prisma.activity.findMany({
          // Drafts are private planning and never end a day that is really running.
          where: { multiDayEventId: { in: eventIds }, status: 'published' },
          select: { multiDayEventId: true, startAt: true, startedAt: true },
        })
      : [],
  ]);

  const nextDayStart = new Map<string, Date>();
  for (const activity of activities) {
    if (!activity.multiDayEventId) continue;
    let next: Date | null = null;
    for (const sibling of siblings) {
      if (sibling.multiDayEventId !== activity.multiDayEventId) continue;
      if (sibling.startAt <= activity.startAt) continue;
      const begins = sibling.startedAt ?? sibling.startAt;
      if (!next || begins < next) next = begins;
    }
    if (next) nextDayStart.set(activity.id, next);
  }

  return {
    zones,
    firstStops: new Map(stops.map((s) => [s.activityId, { id: s.id, time: s.time }])),
    nextDayStart,
  };
}

/** The zone an event runs in, or null when nobody has set one anywhere. */
export function zoneOf(activity: Activity, ctx: StatusContext): string | null {
  const inherited = ctx.zones.get(activity.groupId);
  return resolveTimeZone({
    activity: activity.timeZone,
    group: inherited?.group,
    leader: inherited?.leader,
  });
}

export function statusOf(
  activity: Activity,
  ctx: StatusContext,
  now: Date = new Date(),
): SharedActivity['status'] {
  return effectiveStatus(
    {
      status: activity.status,
      startAt: activity.startAt,
      endAt: activity.endAt,
      allDay: activity.allDay,
      startedAt: activity.startedAt,
      endedAt: activity.endedAt,
      timeZone: zoneOf(activity, ctx),
      firstStopAt: ctx.firstStops.get(activity.id)?.time ?? null,
      nextDayStartAt: ctx.nextDayStart.get(activity.id) ?? null,
    },
    now,
  );
}

/**
 * Where the group is. The leader's moves are stored; until the first one, a running event has the
 * group at the first stop on the plan — "we meet at the clock tower at nine" — without anything
 * having been written. Null before the event begins, and when there is no plan yet.
 */
export function currentStopIdOf(
  activity: Activity,
  ctx: StatusContext,
  status: SharedActivity['status'],
): string | null {
  if (activity.currentMeetingPointId) return activity.currentMeetingPointId;
  if (status !== 'in_progress') return null;
  return ctx.firstStops.get(activity.id)?.id ?? null;
}

/** An activity row with its status worked out — for the gates, which read `status` directly. */
export async function withEffectiveStatus(activity: Activity): Promise<Activity> {
  const ctx = await loadStatusContext([activity]);
  return { ...activity, status: statusOf(activity, ctx) };
}

/** The row's current stop id as seen right now, stored or implied. */
export async function currentStopId(activity: Activity): Promise<string | null> {
  const ctx = await loadStatusContext([activity]);
  return currentStopIdOf(activity, ctx, statusOf(activity, ctx));
}

/** Where the group is, as the full stop — what "On My Way" is measured to. Null when nowhere yet. */
export async function getCurrentStop(activityId: string): Promise<MeetingPointRow | null> {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) return null;
  const id = await currentStopId(activity);
  return id ? getMeetingPointById(id) : null;
}
