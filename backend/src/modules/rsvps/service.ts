import type {
  Attendee,
  Rsvp as SharedRsvp,
  RsvpUpdateDto,
  RsvpWithUser,
} from '@meetingpnt/shared';
import type { Rsvp, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { displayName } from '../../lib/userName.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { assertActivityParticipant } from '../activities/service.js';

/** How the RSVP dashboard reads top to bottom, rather than alphabetically or by reply time. */
const RSVP_DISPLAY_ORDER: Record<Rsvp['status'], number> = {
  approved: 0,
  pending: 1,
  declined: 2,
};

function toSharedRsvp(rsvp: Rsvp): SharedRsvp {
  return {
    id: rsvp.id,
    activityId: rsvp.activityId,
    userId: rsvp.userId,
    status: rsvp.status,
    note: rsvp.note,
    respondedAt: rsvp.respondedAt?.toISOString() ?? null,
    updatedAt: rsvp.updatedAt.toISOString(),
  };
}

export async function upsertRsvp(activityId: string, userId: string, dto: RsvpUpdateDto) {
  const activity = await assertActivityParticipant(activityId, userId);

  if (activity.startAt < new Date()) {
    throw new HttpError(409, 'This activity has already started; RSVP is locked');
  }

  const rsvp = await prisma.rsvp.upsert({
    where: { activityId_userId: { activityId, userId } },
    create: { activityId, userId, status: dto.status, note: dto.note, respondedAt: new Date() },
    update: { status: dto.status, note: dto.note, respondedAt: new Date() },
  });

  return toSharedRsvp(rsvp);
}

/**
 * Lets the leader answer on someone's behalf — "they rang to say they can't make it". Deliberately
 * not bound by the start-time lock that applies to members answering for themselves, since this is
 * most useful once an event is already under way.
 */
export async function setRsvpAsLeader(
  activityId: string,
  targetUserId: string,
  requesterId: string,
  dto: RsvpUpdateDto,
) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  const group = await prisma.group.findUnique({ where: { id: activity.groupId } });
  if (!group || group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can answer for someone else');
  }
  await assertActivityParticipant(activityId, targetUserId);

  const rsvp = await prisma.rsvp.upsert({
    where: { activityId_userId: { activityId, userId: targetUserId } },
    create: {
      activityId,
      userId: targetUserId,
      status: dto.status,
      note: dto.note,
      respondedAt: new Date(),
    },
    update: { status: dto.status, note: dto.note, respondedAt: new Date() },
  });

  return toSharedRsvp(rsvp);
}

/**
 * Who's coming, as one participant sees the others: confirmed attendees only, names alone.
 * No attendance or roll-call data — that's the leader's view, not something peers see about
 * each other. Any participant can call this, unlike the full RSVP dashboard.
 */
export async function listAttendees(activityId: string, requesterId: string): Promise<Attendee[]> {
  await assertActivityParticipant(activityId, requesterId);

  const [approved, guests] = await Promise.all([
    prisma.rsvp.findMany({
      where: { activityId, status: 'approved' },
      include: { user: true },
    }),
    prisma.activityGuest.findMany({ where: { activityId }, select: { userId: true } }),
  ]);

  const guestIds = new Set(guests.map((g) => g.userId));

  return approved
    .map((rsvp) => ({
      user: { id: rsvp.user.id, name: displayName(rsvp.user), avatarUrl: rsvp.user.avatarUrl },
      isVisitor: guestIds.has(rsvp.userId),
    }))
    .sort((a, b) => a.user.name.localeCompare(b.user.name));
}

export async function getMyRsvp(activityId: string, userId: string) {
  const rsvp = await prisma.rsvp.findUnique({ where: { activityId_userId: { activityId, userId } } });
  return rsvp ? toSharedRsvp(rsvp) : null;
}

export async function listRsvps(activityId: string, requesterId: string): Promise<RsvpWithUser[]> {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  const group = await prisma.group.findUnique({ where: { id: activity.groupId } });
  if (!group || group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can view the RSVP dashboard');
  }

  const [rsvps, guests] = await Promise.all([
    prisma.rsvp.findMany({
      where: { activityId },
      include: { user: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.activityGuest.findMany({ where: { activityId }, include: { user: true } }),
  ]);

  const guestUserIds = new Set(guests.map((guest) => guest.userId));

  const fromRsvps = rsvps.map((rsvp: Rsvp & { user: User }) => ({
    ...toSharedRsvp(rsvp),
    user: { id: rsvp.user.id, name: displayName(rsvp.user), email: rsvp.user.email },
    isVisitor: guestUserIds.has(rsvp.userId),
  }));

  // A visitor who hasn't responded has no RSVP row yet, but the leader still needs to see them
  // on the dashboard — otherwise someone they invited simply wouldn't appear.
  const respondedUserIds = new Set(rsvps.map((rsvp) => rsvp.userId));
  const awaitingGuests = guests
    .filter((guest) => !respondedUserIds.has(guest.userId))
    .map((guest) => ({
      id: `guest:${guest.id}`,
      activityId,
      userId: guest.userId,
      status: 'pending' as const,
      note: null,
      respondedAt: null,
      updatedAt: guest.createdAt.toISOString(),
      user: { id: guest.user.id, name: displayName(guest.user), email: guest.user.email },
      isVisitor: true,
    }));

  // Members first, visitors after them, as they're the exception rather than the roster. Within
  // each block: who's coming, then who still owes an answer, then who isn't — the leader's
  // attention runs down that list. Name breaks ties so rows don't reshuffle as replies land.
  return [...fromRsvps, ...awaitingGuests].sort(
    (a, b) =>
      Number(a.isVisitor) - Number(b.isVisitor) ||
      RSVP_DISPLAY_ORDER[a.status] - RSVP_DISPLAY_ORDER[b.status] ||
      a.user.name.localeCompare(b.user.name),
  );
}
