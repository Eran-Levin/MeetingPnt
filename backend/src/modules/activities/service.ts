import { randomUUID } from 'node:crypto';
import type {
  ActivityWithGroup,
  Activity as SharedActivity,
  CreateActivityDto,
  UpdateActivityDto,
} from '@meetingpnt/shared';
import type { Activity } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import {
  getNextPlannedMeetingPoint,
  insertMeetingPoint,
  markMeetingPointArrived,
  shiftMeetingPointTimes,
} from '../../db/geo.js';
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
    endAt: activity.endAt.toISOString(),
    allDay: activity.allDay,
    transportMode: activity.transportMode,
    requiresRsvp: activity.requiresRsvp,
    singleLocation: activity.singleLocation,
    status: activity.status,
    currentMeetingPointId: activity.currentMeetingPointId,
    leaderBroadcastUntil: activity.leaderBroadcastUntil?.toISOString() ?? null,
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

  // Each occurrence keeps the same duration as the first — carrying the literal endAt across
  // would give every session in a series the first session's end.
  const durationMs = new Date(dto.endAt).getTime() - firstStartAt.getTime();

  const activities = await prisma.$transaction(
    occurrenceDates.map((startAt) =>
      prisma.activity.create({
        data: {
          groupId,
          seriesId,
          title: dto.title,
          description: dto.description,
          startAt,
          endAt: new Date(startAt.getTime() + durationMs),
          allDay: dto.allDay,
          transportMode: dto.transportMode,
          requiresRsvp: dto.requiresRsvp,
          singleLocation: dto.singleLocation,
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

  // A patch may move only one end, so the range has to be re-checked against the stored value —
  // the schema can only compare the two when both are present in the request.
  const nextStartAt = dto.startAt !== undefined ? new Date(dto.startAt) : activity.startAt;
  const nextEndAt = dto.endAt !== undefined ? new Date(dto.endAt) : activity.endAt;
  if (nextEndAt <= nextStartAt) {
    throw new HttpError(400, 'The end must be after the start');
  }

  // An event that hasn't run yet can't be scheduled into the past. Once it has started or
  // finished, back-dating is allowed — that's a leader correcting the record, not planning.
  const notYetRun = activity.status === 'draft' || activity.status === 'published';
  if (notYetRun && dto.startAt !== undefined && nextStartAt.getTime() < Date.now()) {
    throw new HttpError(400, "You can't schedule an event in the past");
  }

  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.startAt !== undefined ? { startAt: new Date(dto.startAt) } : {}),
      ...(dto.endAt !== undefined ? { endAt: new Date(dto.endAt) } : {}),
      ...(dto.allDay !== undefined ? { allDay: dto.allDay } : {}),
      ...(dto.transportMode !== undefined ? { transportMode: dto.transportMode } : {}),
      ...(dto.requiresRsvp !== undefined ? { requiresRsvp: dto.requiresRsvp } : {}),
      ...(dto.singleLocation !== undefined ? { singleLocation: dto.singleLocation } : {}),
    },
  });

  await shiftMeetingPointTimes(activityId, nextStartAt.getTime() - activity.startAt.getTime());

  if (dto.requiresRsvp !== undefined && dto.requiresRsvp !== activity.requiresRsvp) {
    await reconcileRsvpsToApprovalSetting(activityId, dto.requiresRsvp);
  }

  return toSharedActivity(updated);
}

/**
 * Brings existing replies into line when a leader flips "Approve attendance" on an activity that
 * has already been published. Without this the setting would only ever apply at publish time, so
 * changing it later would look like it worked and change nothing.
 *
 * `respondedAt` is what separates a real answer from a seeded one: it's null on rows created by
 * publishing and set the moment anybody — member or leader on their behalf — actually replies.
 * So a genuine "I'm coming" or "I can't make it" always survives the switch; only the rows nobody
 * ever touched get moved.
 */
async function reconcileRsvpsToApprovalSetting(activityId: string, requiresRsvp: boolean) {
  if (requiresRsvp) {
    // Now asking people to confirm: anyone auto-approved at publish hasn't actually said yes.
    await prisma.rsvp.updateMany({
      where: { activityId, status: 'approved', respondedAt: null },
      data: { status: 'pending' },
    });
    return;
  }

  // No longer asking: anyone who never replied counts as coming. Declines stand — someone who
  // said they can't make it doesn't get signed back up by a settings change.
  await prisma.rsvp.updateMany({
    where: { activityId, status: 'pending', respondedAt: null },
    data: { status: 'approved' },
  });
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

/** Marks an event as running. Purely a signal to members and the leader's own UI —
 * nothing is gated on it, unlike ending. */
export async function startActivity(activityId: string, requesterId: string) {
  const activity = await getActivityOrThrow(activityId);
  await assertGroupLeader(activity.groupId, requesterId);

  if (activity.status !== 'published') {
    throw new HttpError(409, 'Only a published activity can be started');
  }

  // Within a group, starting is a handover: day 3 of a trek takes over from day 2, which is what
  // keeps a multi-day trip continuous. The old event runs right up to the moment the new one
  // begins, so location sharing never lapses overnight — the gap between an evening's end and the
  // next morning's start is exactly when a guide is most likely to need to find someone.
  const runningInGroup = await prisma.activity.findFirst({
    where: { status: 'in_progress', groupId: activity.groupId },
  });
  if (runningInGroup) {
    await prisma.activity.update({
      where: { id: runningInGroup.id },
      data: { status: 'completed', leaderBroadcastUntil: null },
    });
  }

  // Across groups it stays a refusal. A leader can't be in two places at once, and silently
  // ending someone else's running event would close location sharing on a group still out there
  // — the one case where doing it quietly is worse than saying no.
  const runningElsewhere = await prisma.activity.findFirst({
    where: { status: 'in_progress', group: { leaderId: requesterId } },
  });
  if (runningElsewhere) {
    throw new HttpError(
      409,
      `You're already running "${runningElsewhere.title}" in another group. End it before starting this one.`,
    );
  }

  // Starting the event puts the group at the first stop on the plan — that's what "we're meeting
  // at the clock tower at nine" means. Without this the event would run with nowhere marked as
  // current, so nobody would have a destination and ETAs would have nothing to measure to.
  const firstPoint = await getNextPlannedMeetingPoint(activityId);
  if (firstPoint) {
    await markMeetingPointArrived(firstPoint.id);
  }

  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: {
      status: 'in_progress',
      ...(firstPoint ? { currentMeetingPointId: firstPoint.id } : {}),
    },
  });
  return toSharedActivity(updated);
}

/** Ends an event. Location sharing and pings stop working from here on — there's no reason
 * to keep locating people after an event is over (see locations/service.ts). */
export async function endActivity(activityId: string, requesterId: string) {
  const activity = await getActivityOrThrow(activityId);
  await assertGroupLeader(activity.groupId, requesterId);

  if (activity.status !== 'published' && activity.status !== 'in_progress') {
    throw new HttpError(409, 'Only a published or in-progress activity can be ended');
  }

  // Ending closes location sharing, and a live broadcast is the loudest form of it. The lease
  // would lapse on its own within the quarter hour, but "the event is over" should stop it now.
  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: { status: 'completed', leaderBroadcastUntil: null },
  });
  return toSharedActivity(updated);
}

export async function listActivities(groupId: string, requesterId: string) {
  const group = await assertMembership(groupId, requesterId);
  const isLeader = group.leaderId === requesterId;
  const activities = await prisma.activity.findMany({
    // Drafts are the leader's own planning space — members only see what's been published.
    where: { groupId, ...(isLeader ? {} : { status: { not: 'draft' } }) },
    orderBy: { startAt: 'asc' },
  });
  return activities.map(toSharedActivity);
}

/** How far back the timeline reaches, so a leader can still finish a roll call after the fact. */
const TIMELINE_LOOKBACK_DAYS = 7;

/**
 * Every activity the caller can act on, across all their groups, oldest first. This is what the
 * mobile home screen is built from — the leader's day is a timeline of events, not a list of groups.
 */
export async function listMyActivities(userId: string): Promise<ActivityWithGroup[]> {
  const groups = await prisma.group.findMany({
    where: { OR: [{ leaderId: userId }, { members: { some: { userId, status: 'active' } } }] },
    select: { id: true },
  });
  // Visitors are attached to one activity without belonging to its group, so pick those up too.
  const guestOf = await prisma.activityGuest.findMany({
    where: { userId },
    select: { activityId: true },
  });

  const since = new Date();
  since.setDate(since.getDate() - TIMELINE_LOOKBACK_DAYS);

  const activities = await prisma.activity.findMany({
    where: {
      endAt: { gte: since },
      OR: [
        { groupId: { in: groups.map((g) => g.id) } },
        { id: { in: guestOf.map((g) => g.activityId) } },
      ],
    },
    include: {
      group: { select: { id: true, name: true, leaderId: true } },
      // The caller's own RSVP only — enough to flag "you haven't replied" without loading everyone's.
      rsvps: { where: { userId }, select: { status: true } },
    },
    orderBy: { startAt: 'asc' },
  });

  return activities
    .filter((activity) => activity.group.leaderId === userId || activity.status !== 'draft')
    .map((activity) => ({
      ...toSharedActivity(activity),
      group: { id: activity.group.id, name: activity.group.name },
      isLeader: activity.group.leaderId === userId,
      myRsvpStatus: activity.rsvps[0]?.status ?? null,
    }));
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
