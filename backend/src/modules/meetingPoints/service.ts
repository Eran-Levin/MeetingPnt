import type { CreateMeetingPointDto, MeetingPoint as SharedMeetingPoint } from '@meetingpnt/shared';
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
import { getIO } from '../../realtime/index.js';
import { assertMembership } from '../groups/service.js';

function toSharedMeetingPoint(row: MeetingPointRow): SharedMeetingPoint {
  return {
    id: row.id,
    groupId: row.groupId,
    activityId: row.activityId,
    label: row.label,
    location: { lat: row.lat, lng: row.lng },
    isPrimary: row.isPrimary,
    reconveneTime: row.reconveneTime?.toISOString() ?? null,
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

export async function createMeetingPoint(
  activityId: string,
  requesterId: string,
  dto: CreateMeetingPointDto,
) {
  const { activity, group } = await assertActivityLeader(activityId, requesterId);

  const existing = await listMeetingPointRows(activityId);
  const isPrimary = existing.length === 0;

  const row = await insertMeetingPoint({
    groupId: group.id,
    activityId: activity.id,
    label: dto.label,
    location: dto.location,
    isPrimary,
    reconveneTime: dto.reconveneTime ? new Date(dto.reconveneTime) : undefined,
    createdBy: requesterId,
  });

  const meetingPoint = toSharedMeetingPoint(row);

  getIO()
    .to(`activity:${activityId}`)
    .emit(SocketEvents.MeetingPointCreated, { meetingPoint });

  return meetingPoint;
}

export async function listMeetingPointsForActivity(activityId: string, requesterId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  await assertMembership(activity.groupId, requesterId);

  const rows = await listMeetingPointRows(activityId);
  return rows.map(toSharedMeetingPoint);
}

export async function updateMeetingPoint(
  meetingPointId: string,
  requesterId: string,
  dto: { label?: string; location?: { lat: number; lng: number }; reconveneTime?: string },
) {
  const existing = await getMeetingPointById(meetingPointId);
  if (!existing) {
    throw new HttpError(404, 'Meeting point not found');
  }
  const group = await prisma.group.findUnique({ where: { id: existing.groupId } });
  if (!group || group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can manage meeting points');
  }

  const row = await updateMeetingPointRow(meetingPointId, {
    label: dto.label,
    location: dto.location,
    reconveneTime: dto.reconveneTime ? new Date(dto.reconveneTime) : undefined,
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
