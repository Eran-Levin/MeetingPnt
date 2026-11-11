import { randomBytes } from 'node:crypto';
import { listFirstMeetingPoints } from '../../db/geo.js';
import { prisma } from '../../db/prisma.js';
import { buildIcsCalendar } from '../../lib/ics.js';
import { HttpError } from '../../middleware/errorHandler.js';

/** Long enough that guessing one is not a thing; URL-safe so it drops straight into the link. */
function newToken(): string {
  return randomBytes(24).toString('base64url');
}

/** The caller's token, made on first ask — most people never subscribe, so most never have one. */
export async function getCalendarToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { calendarToken: true },
  });
  if (!user) throw new HttpError(404, 'user_not_found');
  if (user.calendarToken) return user.calendarToken;
  return resetCalendarToken(userId);
}

/** A new token is the only way to revoke the link: whatever was subscribed to the old one goes
 * quiet at its next refresh. */
export async function resetCalendarToken(userId: string): Promise<string> {
  const calendarToken = newToken();
  await prisma.user.update({ where: { id: userId }, data: { calendarToken } });
  return calendarToken;
}

/** How far back the feed reaches. A calendar app drops whatever leaves the feed, so without this
 * last week's walk would vanish from someone's calendar the day after it happened. */
const FEED_LOOKBACK_DAYS = 90;

/**
 * Everything on one person's calendar, as a feed their calendar app re-reads on its own schedule.
 *
 * The same reach as the mobile timeline (`listMyActivities`): groups they lead, groups they belong
 * to, and events they're a visitor at. Two things are left out on purpose:
 *
 * - **Drafts and cancelled events, for everyone — the leader included.** A draft is private
 *   planning, and a subscription link is a copy of the calendar held by a third party; a plan that
 *   isn't published yet has no business there. Publishing is what puts it on calendars.
 * - **Events the person declined.** Saying "I can't make it" should take it off their calendar.
 *
 * Returns null for an unknown token, so a reset link reads as gone rather than as an empty calendar.
 */
export async function buildCalendarFeed(token: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { calendarToken: token },
    select: { id: true },
  });
  if (!user) return null;
  const userId = user.id;

  const groups = await prisma.group.findMany({
    where: { OR: [{ leaderId: userId }, { members: { some: { userId, status: 'active' } } }] },
    select: { id: true },
  });
  const guestOf = await prisma.activityGuest.findMany({
    where: { userId },
    select: { activityId: true },
  });

  const since = new Date();
  since.setDate(since.getDate() - FEED_LOOKBACK_DAYS);

  const activities = await prisma.activity.findMany({
    where: {
      endAt: { gte: since },
      status: { notIn: ['draft', 'cancelled'] },
      OR: [
        { groupId: { in: groups.map((g) => g.id) } },
        { id: { in: guestOf.map((g) => g.activityId) } },
      ],
    },
    include: {
      group: { select: { name: true, leaderId: true } },
      rsvps: { where: { userId }, select: { status: true } },
    },
    orderBy: { startAt: 'asc' },
  });

  const mine = activities.filter(
    (a) => a.group.leaderId === userId || a.rsvps[0]?.status !== 'declined',
  );

  const firstPoints = new Map(
    (await listFirstMeetingPoints(mine.map((a) => a.id))).map((p) => [p.activityId, p]),
  );

  return buildIcsCalendar(
    mine.map((activity) => {
      const start = firstPoints.get(activity.id);
      return {
        uid: activity.id,
        title: activity.title,
        // No labels, so nothing here needs translating: the group, what the leader wrote, and a
        // link to where it starts.
        description: [activity.group.name, activity.description, start?.googleMapsUrl]
          .filter(Boolean)
          .join('\n\n'),
        location: start?.label ?? null,
        startAt: activity.startAt,
        endAt: activity.endAt,
        allDay: activity.allDay,
        updatedAt: activity.updatedAt,
      };
    }),
    'MeetingPnt',
  );
}
