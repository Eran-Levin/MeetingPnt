import type { Activity as SharedActivity, CreateActivityDto, UpdateActivityDto } from '@meetingpnt/shared';
import type { Activity } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { sendPushNotifications } from '../../lib/expoPushClient.js';
import { buildIcsEvent } from '../../lib/ics.js';
import { assertMembership } from '../groups/service.js';

function toSharedActivity(activity: Activity): SharedActivity {
  return {
    id: activity.id,
    groupId: activity.groupId,
    title: activity.title,
    description: activity.description,
    startAt: activity.startAt.toISOString(),
    transportMode: activity.transportMode,
    status: activity.status,
    createdBy: activity.createdBy,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

async function assertGroupLeader(groupId: string, requesterId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new HttpError(404, 'Group not found');
  }
  if (group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can manage activities');
  }
  return group;
}

async function getActivityOrThrow(activityId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  return activity;
}

export async function createActivity(groupId: string, requesterId: string, dto: CreateActivityDto) {
  await assertGroupLeader(groupId, requesterId);
  const activity = await prisma.activity.create({
    data: {
      groupId,
      title: dto.title,
      description: dto.description,
      startAt: new Date(dto.startAt),
      transportMode: dto.transportMode,
      createdBy: requesterId,
      status: 'draft',
    },
  });
  return toSharedActivity(activity);
}

export async function updateActivity(activityId: string, requesterId: string, dto: UpdateActivityDto) {
  const activity = await getActivityOrThrow(activityId);
  await assertGroupLeader(activity.groupId, requesterId);

  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.startAt !== undefined ? { startAt: new Date(dto.startAt) } : {}),
      ...(dto.transportMode !== undefined ? { transportMode: dto.transportMode } : {}),
    },
  });
  return toSharedActivity(updated);
}

export async function publishActivity(activityId: string, requesterId: string) {
  const activity = await getActivityOrThrow(activityId);
  const group = await assertGroupLeader(activity.groupId, requesterId);

  if (activity.status !== 'draft') {
    throw new HttpError(409, 'Only draft activities can be published');
  }

  const members = await prisma.groupMember.findMany({
    where: { groupId: activity.groupId, status: 'active' },
    include: { user: { include: { pushTokens: true } } },
  });

  const updated = await prisma.$transaction(async (tx) => {
    const publishedActivity = await tx.activity.update({
      where: { id: activityId },
      data: { status: 'published' },
    });

    await tx.rsvp.createMany({
      data: members.map((member) => ({ activityId, userId: member.userId, status: 'pending' as const })),
      skipDuplicates: true,
    });

    return publishedActivity;
  });

  const recipients = members.filter((m) => m.userId !== requesterId).flatMap((m) => m.user.pushTokens);
  await sendPushNotifications(
    recipients.map((token) => ({
      to: token.expoPushToken,
      title: `New activity in ${group.name}`,
      body: `${activity.title} — RSVP now`,
      data: { type: 'activity_published', activityId },
    })),
  );

  return toSharedActivity(updated);
}

export async function listActivities(groupId: string, requesterId: string) {
  await assertMembership(groupId, requesterId);
  const activities = await prisma.activity.findMany({
    where: { groupId },
    orderBy: { startAt: 'asc' },
  });
  return activities.map(toSharedActivity);
}

export async function getActivity(activityId: string, requesterId: string) {
  const activity = await getActivityOrThrow(activityId);
  await assertMembership(activity.groupId, requesterId);
  return toSharedActivity(activity);
}

export async function deleteActivity(activityId: string, requesterId: string) {
  const activity = await getActivityOrThrow(activityId);
  await assertGroupLeader(activity.groupId, requesterId);
  await prisma.activity.delete({ where: { id: activityId } });
}

export async function generateIcs(activityId: string, requesterId: string): Promise<string> {
  const activity = await getActivityOrThrow(activityId);
  await assertMembership(activity.groupId, requesterId);
  return buildIcsEvent({
    uid: activity.id,
    title: activity.title,
    description: activity.description,
    startAt: activity.startAt,
  });
}
