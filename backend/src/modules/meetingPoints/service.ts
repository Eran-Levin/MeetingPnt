import type {
  CreateMeetingPointDto,
  MeetingPoint as SharedMeetingPoint,
  UpdateMeetingPointDto,
} from '@meetingpnt/shared';
import { SocketEvents } from '@meetingpnt/shared';
import {
  getMeetingPointById,
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
