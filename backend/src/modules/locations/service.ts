import type {
  LeaderLocationRequestResult,
  LocationSnapshot as SharedLocationSnapshot,
  OmwLocationDto,
  PingRequestDto,
  PingResponseDto,
} from '@meetingpnt/shared';
import { LocationSource, SocketEvents, isLeaderBroadcasting } from '@meetingpnt/shared';
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

  // A broadcast fix gets no ETA. The leader isn't travelling to the meeting point — they're what
  // the group is heading towards — so the number would be meaningless, and at a fix every 30
  // seconds it would also be a billed Directions call every 30 seconds for the length of the event.
  const eta =
    source === LocationSource.LeaderBroadcast
      ? null
      : await getEta(
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

/**
 * How long a broadcast runs before it lapses on its own. Short enough that a phone going into a
 * bag, dying, or losing signal stops the sharing without anyone deciding to; long enough that a
 * leader isn't re-arming it constantly. The mobile client renews while it's still posting fixes,
 * so in practice this is the timeout, not the duration.
 */
const BROADCAST_LEASE_MS = 15 * 60 * 1000;

/** Server-side floor on how often a broadcast fix is stored. */
const BROADCAST_MIN_INTERVAL_MS = 30 * 1000;

/** …unless the leader has moved this far, which is worth recording immediately. */
const BROADCAST_MIN_MOVE_METRES = 50;

function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function assertIsLeader(activityId: string, requesterId: string) {
  const { activity, group } = await getActivityWithLeader(activityId);
  if (group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can share a live position');
  }
  return { activity, group };
}

function emitBroadcastChanged(activityId: string, until: Date | null) {
  getIO()
    .to(activityRoom(activityId))
    .emit(SocketEvents.LeaderBroadcastChanged, {
      activityId,
      until: until?.toISOString() ?? null,
    });
}

/**
 * Start (or renew) "follow me".
 *
 * Deliberately not capped at the activity's scheduled end. That was the first shape, and it is
 * wrong: events overrun, and a trek day still going half an hour past its planned finish is
 * precisely when a guide needs the flag up. What keeps a broadcast from outliving its event is the
 * lease — it lapses within the quarter hour once the phone stops posting fixes — and ending the
 * event, which clears it outright. An event nobody ever ends is a separate problem, tracked in
 * BACKLOG.
 */
export async function startLeaderBroadcast(activityId: string, requesterId: string) {
  const { activity } = await assertIsLeader(activityId, requesterId);
  assertActivityLive(activity);
  if (activity.status !== 'in_progress') {
    throw new HttpError(409, 'Start the event before sharing a live position');
  }

  const until = new Date(Date.now() + BROADCAST_LEASE_MS);

  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: { leaderBroadcastUntil: until },
  });
  emitBroadcastChanged(activityId, until);
  return { until: updated.leaderBroadcastUntil!.toISOString() };
}

export async function stopLeaderBroadcast(activityId: string, requesterId: string) {
  await assertIsLeader(activityId, requesterId);
  await prisma.activity.update({
    where: { id: activityId },
    data: { leaderBroadcastUntil: null },
  });
  emitBroadcastChanged(activityId, null);
  return { until: null };
}

/**
 * One fix from a running broadcast.
 *
 * Throttled server-side rather than trusting the client's cadence: a fix is stored only if the
 * last one is old enough or the leader has moved far enough. Without this a six-hour trek day at a
 * fix every fifteen seconds is well over a thousand rows for one leader, and `location_snapshots`
 * has no retention purge yet (see BACKLOG) — so the volume would simply accumulate. A leader
 * standing still costs almost nothing; one walking is recorded as often as it takes to follow them.
 */
export async function recordBroadcastFix(
  activityId: string,
  requesterId: string,
  dto: OmwLocationDto,
) {
  const { activity } = await assertIsLeader(activityId, requesterId);
  assertActivityLive(activity);
  if (!isLeaderBroadcasting(activity.leaderBroadcastUntil)) {
    throw new HttpError(409, 'Live position sharing is not running for this activity');
  }

  const previous = await getLatestSnapshotForUser(activityId, requesterId);
  if (previous && previous.source === LocationSource.LeaderBroadcast) {
    const sinceLast = Date.now() - previous.createdAt.getTime();
    const moved = metresBetween(
      { lat: previous.lat, lng: previous.lng },
      { lat: dto.location.lat, lng: dto.location.lng },
    );
    if (sinceLast < BROADCAST_MIN_INTERVAL_MS && moved < BROADCAST_MIN_MOVE_METRES) {
      return toSharedSnapshot(previous);
    }
  }

  // Renew the lease off the leader's own fixes: while their phone is reporting, the broadcast is
  // demonstrably alive, and when it stops reporting the lease is what ends it.
  await prisma.activity.update({
    where: { id: activityId },
    data: { leaderBroadcastUntil: new Date(Date.now() + BROADCAST_LEASE_MS) },
  });

  return recordSnapshot(activityId, requesterId, dto.location, LocationSource.LeaderBroadcast);
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

/**
 * How fresh the leader's position has to be for a member's question to be already answered. Below
 * this, asking costs the leader nothing — they get the position that's already on file.
 */
const LEADER_POSITION_FRESH_MS = 2 * 60 * 1000;

/** At most one notification per activity per window, however many people ask inside it. */
const ASK_COALESCE_WINDOW_MS = 60 * 1000;

/**
 * When the leader was last notified that someone is asking, per activity. Eight trekkers each
 * tapping "where are you" is eight pushes to one guide, which is how a useful feature becomes one
 * the guide switches off.
 *
 * The notification fires on the *first* ask and later ones inside the window are absorbed, rather
 * than waiting out the window to collect names. "Where are you" is urgent, and delaying every
 * single-asker case by a minute to occasionally say "and 2 others" is a bad trade — so the
 * notification names one person and the others ride along silently. They lose nothing: the answer
 * is a leader position, which reaches every attendee.
 *
 * Deliberately in-process. It holds seconds of state that is worthless if lost, and the codebase
 * already treats Redis as optional (see the adapter note in realtime/index.ts), so requiring it
 * here would make a second instance mandatory for correctness rather than for scale. Running more
 * than one instance degrades this to one notification per instance per window — noisier, never
 * wrong. If the backend is ever scaled, move this to Redis rather than dropping it.
 */
const lastAskNotifiedAt = new Map<string, number>();

function pruneAsks(now: number) {
  for (const [activityId, notifiedAt] of lastAskNotifiedAt) {
    if (now - notifiedAt > ASK_COALESCE_WINDOW_MS) lastAskNotifiedAt.delete(activityId);
  }
}

/**
 * A member asking the leader where they are — the counterpart to `requestPing`, which is the
 * leader asking a member. The leader answers through the existing ping-response endpoint, so the
 * position they share reaches every attendee the same way any leader position does.
 */
export async function requestLeaderLocation(
  activityId: string,
  requesterId: string,
): Promise<LeaderLocationRequestResult> {
  const { activity, group } = await getActivityWithLeader(activityId);
  assertActivityLive(activity);
  await assertLeaderOrApproved(activityId, requesterId, group.leaderId);

  const location = await getLeaderLocation(activityId, requesterId);

  // Already answered: the leader reported a position moments ago, so don't disturb them for it.
  // Once leader broadcasting exists this is the path that makes a live broadcast silence the
  // question entirely, because every fix refreshes this timestamp.
  const now = Date.now();
  if (location && now - new Date(location.capturedAt).getTime() < LEADER_POSITION_FRESH_MS) {
    return { location, notified: false };
  }

  // A leader asking after their own position is answered, never notified.
  if (requesterId === group.leaderId) {
    return { location, notified: false };
  }

  pruneAsks(now);
  const notifiedAt = lastAskNotifiedAt.get(activityId);
  if (notifiedAt !== undefined && now - notifiedAt < ASK_COALESCE_WINDOW_MS) {
    return { location, notified: false };
  }
  lastAskNotifiedAt.set(activityId, now);

  const requester = await prisma.user.findUnique({ where: { id: requesterId } });
  const pushTokens = await prisma.pushToken.findMany({ where: { userId: group.leaderId } });
  await sendPushNotifications(
    pushTokens.map((token) => ({
      to: token.expoPushToken,
      title: 'Where are you?',
      body: `${displayName(requester!)} asked where you are in ${activity.title}.`,
      data: { type: 'leader_location_request', activityId },
      priority: 'high',
      categoryId: 'leader_location_request',
    })),
  );

  return { location, notified: true };
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
