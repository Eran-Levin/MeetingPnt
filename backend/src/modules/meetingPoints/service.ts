import type {
  CreateMeetingPointDto,
  MeetingPoint as SharedMeetingPoint,
  UpdateMeetingPointDto,
} from '@meetingpnt/shared';
import { SocketEvents } from '@meetingpnt/shared';
import {
  deleteMeetingPoint,
  getMeetingPointById,
  getNextPlannedMeetingPoint,
  insertMeetingPoint,
  listMeetingPoints as listMeetingPointRows,
  updateMeetingPoint as updateMeetingPointRow,
  type MeetingPointRow,
} from '../../db/geo.js';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { parseGoogleMapsUrl } from '../../lib/googleMapsUrlParser.js';
import { getIO } from '../../realtime/index.js';
import { assertActivityParticipant } from '../activities/service.js';

function toSharedMeetingPoint(row: MeetingPointRow): SharedMeetingPoint {
  return {
    id: row.id,
    groupId: row.groupId,
    activityId: row.activityId,
    label: row.label,
    googleMapsUrl: row.googleMapsUrl,
    location: { lat: row.lat, lng: row.lng },
    time: row.time.toISOString(),
    arrivedAt: row.arrivedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertActivityLeader(activityId: string, requesterId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  const group = await prisma.group.findUnique({ where: { id: activity.groupId } });
  if (!group || group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can manage meeting points');
  }
  return { activity, group };
}

async function resolveLocation(googleMapsUrl: string, fallback?: { lat: number; lng: number }) {
  const parsed = await parseGoogleMapsUrl(googleMapsUrl);
  if (parsed) return parsed;
  if (fallback) return fallback;
  throw new HttpError(
    400,
    "Couldn't read coordinates from that Google Maps link — please drop a pin instead.",
  );
}

/**
 * Adds a stop to the plan. This is planning, not moving: the new stop is not marked as reached
 * and the group stays where it is. Moving the group is `advanceToNextMeetingPoint`.
 */
export async function createMeetingPoint(
  activityId: string,
  requesterId: string,
  dto: CreateMeetingPointDto,
) {
  const { activity, group } = await assertActivityLeader(activityId, requesterId);
  const location = await resolveLocation(dto.googleMapsUrl, dto.location);

  const row = await insertMeetingPoint({
    groupId: group.id,
    activityId: activity.id,
    label: dto.label,
    googleMapsUrl: dto.googleMapsUrl,
    location,
    // A point dropped mid-event has no explicit time — it's happening now.
    time: dto.time ? new Date(dto.time) : new Date(),
    createdBy: requesterId,
  });

  const meetingPoint = toSharedMeetingPoint(row);

  getIO()
    .to(`activity:${activityId}`)
    .emit(SocketEvents.MeetingPointCreated, { meetingPoint });

  return meetingPoint;
}

/**
 * Moves the group on to the next stop — the "Next meeting point" button.
 *
 * Two cases, and the leader sees the same form either way:
 *
 *  - The itinerary has an unreached stop next. The leader's edits are applied to it (the plan
 *    said the market at 11, they actually got there at 11:40 and went to the other entrance),
 *    then it's marked as reached.
 *  - They're off the end of the plan and improvising. A new stop is created, already reached.
 *
 * The arrival stamp and the activity's current pointer move together in one transaction, so the
 * group can never be recorded as standing somewhere it hasn't arrived.
 */
export async function advanceToNextMeetingPoint(
  activityId: string,
  requesterId: string,
  dto: CreateMeetingPointDto,
) {
  const { activity, group } = await assertActivityLeader(activityId, requesterId);

  if (activity.status === 'completed') {
    throw new HttpError(409, "This event has ended — you can't move the group on.");
  }

  const location = await resolveLocation(dto.googleMapsUrl, dto.location);
  const planned = await getNextPlannedMeetingPoint(activityId);
  // A stop reached without a planned time is happening now.
  const time = dto.time ? new Date(dto.time) : new Date();

  const row = planned
    ? await updateMeetingPointRow(planned.id, {
        label: dto.label,
        googleMapsUrl: dto.googleMapsUrl,
        location,
        time,
        arrivedAt: new Date(),
      })
    : await insertMeetingPoint({
        groupId: group.id,
        activityId: activity.id,
        label: dto.label,
        googleMapsUrl: dto.googleMapsUrl,
        location,
        time,
        arrivedAt: new Date(),
        createdBy: requesterId,
      });

  if (!row) {
    throw new HttpError(404, 'Meeting point not found');
  }

  await prisma.activity.update({
    where: { id: activityId },
    data: { currentMeetingPointId: row.id },
  });

  const meetingPoint = toSharedMeetingPoint(row);
  getIO().to(`activity:${activityId}`).emit(SocketEvents.MeetingPointCreated, { meetingPoint });
  return meetingPoint;
}

/**
 * Drops a stop from the plan. Only stops the group never reached: a visited one is a record of
 * where the group actually went, and it may already carry a roll call.
 */
export async function removeMeetingPoint(meetingPointId: string, requesterId: string) {
  const existing = await getMeetingPointById(meetingPointId);
  if (!existing) {
    throw new HttpError(404, 'Meeting point not found');
  }
  const group = await prisma.group.findUnique({ where: { id: existing.groupId } });
  if (!group || group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can manage meeting points');
  }
  if (existing.arrivedAt) {
    throw new HttpError(
      409,
      "The group already met here, so this stop is part of the event's record and can't be removed.",
    );
  }

  await deleteMeetingPoint(meetingPointId);
}

/** What "Next meeting point" should pre-fill with, or null when the leader is off-plan. */
export async function peekNextPlannedMeetingPoint(activityId: string, requesterId: string) {
  await assertActivityLeader(activityId, requesterId);
  const row = await getNextPlannedMeetingPoint(activityId);
  return row ? toSharedMeetingPoint(row) : null;
}

/**
 * Everyone on the activity gets the whole itinerary — leader and member alike.
 *
 * Members were briefly restricted to the current stop, on the reasoning that they should be told
 * where to walk rather than handed the day's schedule. The restriction was solving the wrong
 * problem: the risk was never that the route is secret, it's that a member glancing at their
 * phone shouldn't have to work out which pin is theirs. That's a presentation job — the current
 * stop leads, the rest of the route sits under it — and knowing the shape of the day is genuinely
 * useful to someone deciding whether to bring lunch.
 *
 * Drafts never reach members at all, so nothing half-planned leaks through this.
 */
export async function listMeetingPointsForActivity(activityId: string, requesterId: string) {
  await assertActivityParticipant(activityId, requesterId);

  const rows = await listMeetingPointRows(activityId);
  return rows.map(toSharedMeetingPoint);
}

export async function updateMeetingPoint(
  meetingPointId: string,
  requesterId: string,
  dto: UpdateMeetingPointDto,
) {
  const existing = await getMeetingPointById(meetingPointId);
  if (!existing) {
    throw new HttpError(404, 'Meeting point not found');
  }
  const group = await prisma.group.findUnique({ where: { id: existing.groupId } });
  if (!group || group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can manage meeting points');
  }

  const location =
    dto.googleMapsUrl !== undefined
      ? await resolveLocation(dto.googleMapsUrl, dto.location)
      : dto.location;

  const row = await updateMeetingPointRow(meetingPointId, {
    label: dto.label,
    googleMapsUrl: dto.googleMapsUrl,
    location,
    time: dto.time ? new Date(dto.time) : undefined,
  });
  if (!row) {
    throw new HttpError(404, 'Meeting point not found');
  }

  const meetingPoint = toSharedMeetingPoint(row);
  if (existing.activityId) {
    getIO()
      .to(`activity:${existing.activityId}`)
      .emit(SocketEvents.MeetingPointCreated, { meetingPoint });
  }
  return meetingPoint;
}
