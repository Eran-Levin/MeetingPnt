import type { Rsvp as SharedRsvp, RsvpUpdateDto, RsvpWithUser } from '@meetingpnt/shared';
import type { Rsvp, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { assertMembership } from '../groups/service.js';

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
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  await assertMembership(activity.groupId, userId);

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

export async function listRsvps(activityId: string, requesterId: string): Promise<RsvpWithUser[]> {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  const group = await prisma.group.findUnique({ where: { id: activity.groupId } });
  if (!group || group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can view the RSVP dashboard');
  }

  const rsvps = await prisma.rsvp.findMany({
    where: { activityId },
    include: { user: true },
    orderBy: { updatedAt: 'desc' },
  });

  return rsvps.map((rsvp: Rsvp & { user: User }) => ({
    ...toSharedRsvp(rsvp),
    user: { id: rsvp.user.id, name: rsvp.user.name, email: rsvp.user.email },
  }));
}
