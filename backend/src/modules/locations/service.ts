import type {
  LocationSnapshot as SharedLocationSnapshot,
  OmwLocationDto,
  PingRequestDto,
  PingResponseDto,
} from '@meetingpnt/shared';
import { LocationSource, SocketEvents } from '@meetingpnt/shared';
import {
  getLatestSnapshotForUser,
  getLatestSnapshotsForActivity,
  getCurrentMeetingPoint,
  insertLocationSnapshot,
  type LocationSnapshotRow,
} from '../../db/geo.js';
import { prisma } from '../../db/prisma.js';
import { displayName } from '../../lib/userName.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { sendPushNotifications } from '../../lib/expoPushClient.js';
import { getEta } from '../../lib/googleMapsClient.js';
import { activityLeaderRoom, activityRoom, getIO } from '../../realtime/index.js';

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

/**
 * A leader is always entitled to take part in their own event's location features, whatever their
 * RSVP row says. Publishing creates an RSVP for every group member including the leader, and it is
 * `pending` whenever the activity requires an RSVP — so gating on the RSVP alone locks the leader
 * out of exactly the events they run. Trips and yoga classes hide this (`requiresRsvp: false`
 * approves everyone up front); a photo walk exposes it.
 */
async function assertLeaderOrApproved(activityId: string, userId: string, leaderId: string) {
  if (userId === leaderId) return;
  await assertApprovedRsvp(activityId, userId);
}

async function getActivityWithLeader(activityId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  const group = await prisma.group.findUnique({ where: { id: activity.groupId } });
  if (!group) {
    throw new HttpError(404, 'Activity not found');
  }
  return { activity, group };
}

/** Once an event is over there's no legitimate reason to keep locating people, so ending an
 * activity closes the location features off. */
function assertActivityLive(activity: { status: string }) {
  if (activity.status === 'completed' || activity.status === 'cancelled') {
    throw new HttpError(409, 'This activity has ended; location sharing is closed');
  }
}

async function recordSnapshot(
  activityId: string,
  userId: string,
  location: { lat: number; lng: number },
  source: (typeof LocationSource)[keyof typeof LocationSource],
) {
  const { activity, group } = await getActivityWithLeader(activityId);
  assertActivityLive(activity);
  await assertLeaderOrApproved(activityId, userId, group.leaderId);

  const meetingPoint = await getCurrentMeetingPoint(activityId);
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
  // Where this goes depends on whose position it is. The leader's is for the whole group; a
  // member's is for the leader alone. See the room split in realtime/index.ts.
  const room =
    userId === group.leaderId ? activityRoom(activityId) : activityLeaderRoom(activityId);
  getIO().to(room).emit(SocketEvents.LocationUpdated, { snapshot });
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
  const { activity, group } = await getActivityWithLeader(activityId);
  if (group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can request a location');
  }
  assertActivityLive(activity);

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
  const { group } = await getActivityWithLeader(activityId);
  if (group.leaderId !== requesterId) {
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
          name: displayName(userById.get(row.userId)!),
          email: userById.get(row.userId)!.email,
        }
      : null,
  }));
}

/**
 * Where the leader is, for anyone attending. The counterpart to `getLatestLocations`, and
 * deliberately not a relaxation of it: this returns one person's position — the leader's — so
 * members still never see each other. Null when the leader hasn't reported a position, which is
 * the normal state until they answer a request or start broadcasting.
 *
 * Not gated on the activity still being live. A completed event stops *producing* positions
 * (`assertActivityLive` on the write path, and the socket room refuses joins), but the last known
 * position of the leader is ordinary history by then, and readable like the rest of it.
 */
export async function getLeaderLocation(activityId: string, requesterId: string) {
  const { group } = await getActivityWithLeader(activityId);
  await assertLeaderOrApproved(activityId, requesterId, group.leaderId);

  const row = await getLatestSnapshotForUser(activityId, group.leaderId);
  if (!row) return null;

  const leader = await prisma.user.findUnique({ where: { id: group.leaderId } });
  return {
    ...toSharedSnapshot(row),
    user: leader ? { id: leader.id, name: displayName(leader), email: leader.email } : null,
  };
}
