import { randomUUID } from 'node:crypto';
import type { Activity as SharedActivity, CreateActivityDto, UpdateActivityDto } from '@meetingpnt/shared';
import type { Activity } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { insertMeetingPoint } from '../../db/geo.js';
import { sendPushNotifications } from '../../lib/expoPushClient.js';
import { parseGoogleMapsUrl } from '../../lib/googleMapsUrlParser.js';
import { buildIcsEvent } from '../../lib/ics.js';
import { generateOccurrenceDates } from '../../lib/recurrence.js';
import { assertMembership } from '../groups/service.js';

function toSharedActivity(activity: Activity): SharedActivity {
  return {
    id: activity.id,
    groupId: activity.groupId,
    seriesId: activity.seriesId,
    title: activity.title,
    description: activity.description,
    startAt: activity.startAt.toISOString(),
    endAt: activity.endAt ? activity.endAt.toISOString() : null,
    transportMode: activity.transportMode,
    requiresRsvp: activity.requiresRsvp,
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

/** Leader, active group member, or an activity guest ("visitor") invited to this specific activity. */
export async function assertActivityParticipant(activityId: string, userId: string) {
  const activity = await getActivityOrThrow(activityId);

  const group = await prisma.group.findUnique({ where: { id: activity.groupId } });
  if (group?.leaderId === userId) {
    return activity;
  }

  const isMember = await prisma.groupMember.findFirst({
    where: { groupId: activity.groupId, userId, status: 'active' },
  });
  if (isMember) {
    return activity;
  }

  const isGuest = await prisma.activityGuest.findFirst({ where: { activityId, userId } });
  if (isGuest) {
    return activity;
  }

  throw new HttpError(403, 'Not a participant of this activity');
}

export async function createActivity(groupId: string, requesterId: string, dto: CreateActivityDto) {
  await assertGroupLeader(groupId, requesterId);

  const firstStartAt = new Date(dto.startAt);
  const occurrenceDates = dto.recurrence
    ? generateOccurrenceDates(firstStartAt, dto.recurrence)
    : [firstStartAt];
  const seriesId = dto.recurrence ? randomUUID() : null;

  const activities = await prisma.$transaction(
    occurrenceDates.map((startAt) =>
      prisma.activity.create({
        data: {
          groupId,
          seriesId,
          title: dto.title,
          description: dto.description,
          startAt,
          endAt: dto.endAt ? new Date(dto.endAt) : null,
          transportMode: dto.transportMode,
          requiresRsvp: dto.requiresRsvp,
          createdBy: requesterId,
          status: 'draft',
        },
      }),
    ),
  );

  if (dto.meetingPoints && dto.meetingPoints.length > 0) {
    // Resolve each template's URL once — the coordinates are the same for every occurrence.
    const resolvedTemplates = await Promise.all(
      dto.meetingPoints.map(async (template) => {
        const location = await parseGoogleMapsUrl(template.googleMapsUrl);
        if (!location) {
          throw new HttpError(
            400,
            `Couldn't read coordinates from the meeting point link "${template.googleMapsUrl}" — please use a link that includes coordinates.`,
          );
        }
        return { ...template, location };
      }),
    );

    for (const activity of activities) {
      for (const template of resolvedTemplates) {
        await insertMeetingPoint({
          groupId,
          activityId: activity.id,
          label: template.label,
          googleMapsUrl: template.googleMapsUrl,
          location: template.location,
          time: new Date(activity.startAt.getTime() + template.offsetMinutes * 60_000),
          createdBy: requesterId,
        });
      }
    }
  }

  return activities.map(toSharedActivity);
}

/** Publishes every still-draft occurrence in a recurring series at once, sending a single
 * summary push per member rather than one per occurrence. */
export async function publishSeries(seriesId: string, requesterId: string) {
  const occurrences = await prisma.activity.findMany({ where: { seriesId } });
  if (occurrences.length === 0) {
    throw new HttpError(404, 'Series not found');
  }
  const group = await assertGroupLeader(occurrences[0]!.groupId, requesterId);

  const draftIds = occurrences.filter((a) => a.status === 'draft').map((a) => a.id);
  if (draftIds.length === 0) {
    throw new HttpError(409, 'All occurrences in this series are already published');
  }

  const members = await prisma.groupMember.findMany({
    where: { groupId: occurrences[0]!.groupId, status: 'active' },
    include: { user: { include: { pushTokens: true } } },
  });

  const requiresRsvpByActivity = new Map(occurrences.map((o) => [o.id, o.requiresRsvp]));

  const updated = await prisma.$transaction(async (tx) => {
    await tx.activity.updateMany({ where: { id: { in: draftIds } }, data: { status: 'published' } });
    await tx.rsvp.createMany({
      data: draftIds.flatMap((activityId) =>
        members.map((member) => ({
          activityId,
          userId: member.userId,
          status: requiresRsvpByActivity.get(activityId) ? ('pending' as const) : ('approved' as const),
        })),
      ),
      skipDuplicates: true,
    });
    return tx.activity.findMany({ where: { seriesId }, orderBy: { startAt: 'asc' } });
  });

  const recipients = members.filter((m) => m.userId !== requesterId).flatMap((m) => m.user.pushTokens);
  await sendPushNotifications(
    recipients.map((token) => ({
      to: token.expoPushToken,
      title: `New recurring activity in ${group.name}`,
      body: `${occurrences[0]!.title} — ${draftIds.length} session${draftIds.length > 1 ? 's' : ''} scheduled. RSVP now`,
      data: { type: 'activity_series_published', seriesId },
    })),
  );

  return updated.map(toSharedActivity);
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
      ...(dto.endAt !== undefined ? { endAt: new Date(dto.endAt) } : {}),
      ...(dto.transportMode !== undefined ? { transportMode: dto.transportMode } : {}),
      ...(dto.requiresRsvp !== undefined ? { requiresRsvp: dto.requiresRsvp } : {}),
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
      data: members.map((member) => ({
        activityId,
        userId: member.userId,
        status: activity.requiresRsvp ? ('pending' as const) : ('approved' as const),
      })),
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
  const activity = await assertActivityParticipant(activityId, requesterId);
  return toSharedActivity(activity);
}

export async function deleteActivity(activityId: string, requesterId: string) {
  const activity = await getActivityOrThrow(activityId);
  await assertGroupLeader(activity.groupId, requesterId);
  await prisma.activity.delete({ where: { id: activityId } });
}

export async function generateIcs(activityId: string, requesterId: string): Promise<string> {
  const activity = await assertActivityParticipant(activityId, requesterId);
  return buildIcsEvent({
    uid: activity.id,
    title: activity.title,
    description: activity.description,
    startAt: activity.startAt,
    endAt: activity.endAt,
  });
}
