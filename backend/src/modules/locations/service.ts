import type {
  LocationSnapshot as SharedLocationSnapshot,
  OmwLocationDto,
  PingRequestDto,
  PingResponseDto,
} from '@meetingpnt/shared';
import { LocationSource, SocketEvents } from '@meetingpnt/shared';
import {
  getLatestSnapshotsForActivity,
  getPrimaryMeetingPoint,
  insertLocationSnapshot,
  type LocationSnapshotRow,
} from '../../db/geo.js';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { sendPushNotifications } from '../../lib/expoPushClient.js';
import { getEta } from '../../lib/googleMapsClient.js';
import { getIO } from '../../realtime/index.js';

function toSharedSnapshot(row: LocationSnapshotRow): SharedLocationSnapshot {
  return {
    id: row.id,
    activityId: row.activityId,
    userId: row.userId,
    meetingPointId: row.meetingPointId,
    location: { lat: row.lat, lng: row.lng },
    capturedAt: row.capturedAt.toISOString(),
    etaSeconds: row.etaSeconds,
    etaComputedAt: row.etaComputedAt?.toISOString() ?? null,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertApprovedRsvp(activityId: string, userId: string) {
  const rsvp = await prisma.rsvp.findFirst({ where: { activityId, userId, status: 'approved' } });
  if (!rsvp) {
    throw new HttpError(403, 'Location features are limited to approved attendees');
  }
}

async function recordSnapshot(
  activityId: string,
  userId: string,
  location: { lat: number; lng: number },
  source: (typeof LocationSource)[keyof typeof LocationSource],
) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  await assertApprovedRsvp(activityId, userId);

  const meetingPoint = await getPrimaryMeetingPoint(activityId);
  if (!meetingPoint) {
    throw new HttpError(409, 'No meeting point has been set for this activity yet');
  }

  const eta = await getEta(
    location,
    { lat: meetingPoint.lat, lng: meetingPoint.lng },
    activity.transportMode,
  );

  const row = await insertLocationSnapshot({
    activityId,
    userId,
    meetingPointId: meetingPoint.id,
    location,
    capturedAt: new Date(),
    etaSeconds: eta?.etaSeconds ?? null,
    etaComputedAt: eta ? new Date() : null,
    source,
  });

  const snapshot = toSharedSnapshot(row);
  getIO().to(`activity:${activityId}`).emit(SocketEvents.LocationUpdated, { snapshot });
  return snapshot;
}

export async function submitOmw(activityId: string, userId: string, dto: OmwLocationDto) {
  return recordSnapshot(activityId, userId, dto.location, LocationSource.Omw);
}

export async function submitPingResponse(
  activityId: string,
  userId: string,
  dto: PingResponseDto,
) {
  return recordSnapshot(activityId, userId, dto.location, LocationSource.PingResponse);
}

export async function requestPing(activityId: string, requesterId: string, dto: PingRequestDto) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  const group = await prisma.group.findUnique({ where: { id: activity.groupId } });
  if (!group || group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can request a location');
  }

  await assertApprovedRsvp(activityId, dto.userId);

  const pushTokens = await prisma.pushToken.findMany({ where: { userId: dto.userId } });
  await sendPushNotifications(
    pushTokens.map((token) => ({
      to: token.expoPushToken,
      title: 'Where are you?',
      body: `The leader of ${group.name} requested your location for ${activity.title}.`,
      data: { type: 'location_ping', activityId },
      priority: 'high',
      categoryId: 'location_ping',
    })),
  );
}

export async function getLatestLocations(activityId: string, requesterId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  const group = await prisma.group.findUnique({ where: { id: activity.groupId } });
  if (!group || group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can view live locations');
  }

  const rows = await getLatestSnapshotsForActivity(activityId);
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } } });
  const userById = new Map(users.map((u) => [u.id, u]));

  return rows.map((row) => ({
    ...toSharedSnapshot(row),
    user: userById.has(row.userId)
      ? {
          id: userById.get(row.userId)!.id,
          name: userById.get(row.userId)!.name,
          email: userById.get(row.userId)!.email,
        }
      : null,
  }));
}
