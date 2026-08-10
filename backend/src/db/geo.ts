import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { GeoPoint, LocationSource } from '@meetingpnt/shared';
import { prisma } from './prisma.js';

const MEETING_POINT_COLUMNS = Prisma.sql`
  id, group_id AS "groupId", activity_id AS "activityId", label, google_maps_url AS "googleMapsUrl",
  ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
  time, arrived_at AS "arrivedAt", created_by AS "createdBy", created_at AS "createdAt"
`;

export interface MeetingPointRow {
  id: string;
  groupId: string;
  activityId: string | null;
  label: string | null;
  googleMapsUrl: string;
  lat: number;
  lng: number;
  time: Date;
  arrivedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

export async function insertMeetingPoint(input: {
  groupId: string;
  activityId: string | null;
  label?: string;
  googleMapsUrl: string;
  location: GeoPoint;
  time: Date;
  /** Set when the leader creates a stop by arriving at it, rather than planning it in advance. */
  arrivedAt?: Date | null;
  createdBy: string;
}): Promise<MeetingPointRow> {
  const id = randomUUID();
  const rows = await prisma.$queryRaw<MeetingPointRow[]>`
    INSERT INTO meeting_points (id, group_id, activity_id, label, google_maps_url, location, time, arrived_at, created_by, created_at)
    VALUES (
      ${id}, ${input.groupId}, ${input.activityId}, ${input.label ?? null}, ${input.googleMapsUrl},
      ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326)::geography,
      ${input.time}, ${input.arrivedAt ?? null}, ${input.createdBy}, now()
    )
    RETURNING ${MEETING_POINT_COLUMNS}
  `;
  return rows[0]!;
}

/**
 * The activity's itinerary in the order the group walks it, ordered by creation rather than by
 * `time`. Sorting by `time` breaks as soon as a point is dropped mid-event on an activity
 * scheduled for the future — "now" sorts before the planned start, so the newest stop would
 * appear first.
 *
 * This is the whole plan, including stops nobody has reached yet. Where the group actually *is*
 * is `Activity.currentMeetingPointId`; which stops they have already walked is `arrivedAt`.
 */
export async function listMeetingPoints(activityId: string): Promise<MeetingPointRow[]> {
  return prisma.$queryRaw<MeetingPointRow[]>`
    SELECT ${MEETING_POINT_COLUMNS} FROM meeting_points
    WHERE activity_id = ${activityId} ORDER BY created_at ASC
  `;
}

/** The stops the group has actually reached, oldest first. */
export async function listArrivedMeetingPoints(activityId: string): Promise<MeetingPointRow[]> {
  return prisma.$queryRaw<MeetingPointRow[]>`
    SELECT ${MEETING_POINT_COLUMNS} FROM meeting_points
    WHERE activity_id = ${activityId} AND arrived_at IS NOT NULL
    ORDER BY arrived_at ASC
  `;
}

/**
 * Where the group is now, and therefore where an "On My Way" ETA is measured to.
 *
 * Read from the stored pointer rather than inferred from the list. It used to be "the most
 * recently created point", which held only while points were created as the group arrived; now
 * that a leader can plan five stops before setting off, the newest point is the *last* stop and
 * inferring from it would send everyone to the end of the route before the event had begun.
 *
 * Whatever this returns must also be what the apps display: "where I'm told to go" and "where my
 * ETA is measured to" have to be the same place.
 */
export async function getCurrentMeetingPoint(activityId: string): Promise<MeetingPointRow | null> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { currentMeetingPointId: true },
  });
  if (!activity?.currentMeetingPointId) return null;
  return getMeetingPointById(activity.currentMeetingPointId);
}

/**
 * The next stop on the plan that the group hasn't reached — what "Next meeting point" pre-fills
 * from. Null once they're off the end of the itinerary, where the leader is improvising.
 */
export async function getNextPlannedMeetingPoint(
  activityId: string,
): Promise<MeetingPointRow | null> {
  const rows = await prisma.$queryRaw<MeetingPointRow[]>`
    SELECT ${MEETING_POINT_COLUMNS} FROM meeting_points
    WHERE activity_id = ${activityId} AND arrived_at IS NULL
    ORDER BY created_at ASC LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function deleteMeetingPoint(id: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM meeting_points WHERE id = ${id}`;
}

/** Stamps a stop as reached. Callers pair this with moving Activity.currentMeetingPointId. */
export async function markMeetingPointArrived(id: string): Promise<MeetingPointRow | null> {
  const rows = await prisma.$queryRaw<MeetingPointRow[]>`
    UPDATE meeting_points SET arrived_at = now() WHERE id = ${id}
    RETURNING ${MEETING_POINT_COLUMNS}
  `;
  return rows[0] ?? null;
}

export async function getMeetingPointById(id: string): Promise<MeetingPointRow | null> {
  const rows = await prisma.$queryRaw<MeetingPointRow[]>`
    SELECT ${MEETING_POINT_COLUMNS} FROM meeting_points WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

export async function updateMeetingPoint(
  id: string,
  input: {
    label?: string;
    googleMapsUrl?: string;
    location?: GeoPoint;
    time?: Date;
    arrivedAt?: Date;
  },
): Promise<MeetingPointRow | null> {
  const sets: Prisma.Sql[] = [];
  if (input.label !== undefined) sets.push(Prisma.sql`label = ${input.label}`);
  if (input.googleMapsUrl !== undefined) {
    sets.push(Prisma.sql`google_maps_url = ${input.googleMapsUrl}`);
  }
  if (input.location !== undefined) {
    sets.push(
      Prisma.sql`location = ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326)::geography`,
    );
  }
  if (input.time !== undefined) {
    sets.push(Prisma.sql`time = ${input.time}`);
  }
  if (input.arrivedAt !== undefined) {
    sets.push(Prisma.sql`arrived_at = ${input.arrivedAt}`);
  }

  if (sets.length === 0) {
    return getMeetingPointById(id);
  }

  const rows = await prisma.$queryRaw<MeetingPointRow[]>`
    UPDATE meeting_points SET ${Prisma.join(sets, ', ')}
    WHERE id = ${id}
    RETURNING ${MEETING_POINT_COLUMNS}
  `;
  return rows[0] ?? null;
}

/**
 * Moving an activity moves its meeting points with it. Times are shifted by the same delta
 * rather than rewritten, so "gather 15 minutes before we start" survives a reschedule — the
 * leader set that offset deliberately and shouldn't have to re-enter it.
 */
export async function shiftMeetingPointTimes(activityId: string, deltaMs: number): Promise<void> {
  if (deltaMs === 0) return;
  const seconds = Math.round(deltaMs / 1000);
  await prisma.$executeRaw`
    UPDATE meeting_points
    SET time = time + (${seconds} * INTERVAL '1 second')
    WHERE activity_id = ${activityId}
  `;
}

const LOCATION_SNAPSHOT_COLUMNS = Prisma.sql`
  id, activity_id AS "activityId", user_id AS "userId", meeting_point_id AS "meetingPointId",
  ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
  captured_at AS "capturedAt", eta_seconds AS "etaSeconds", eta_computed_at AS "etaComputedAt",
  source, created_at AS "createdAt"
`;

export interface LocationSnapshotRow {
  id: string;
  activityId: string;
  userId: string;
  meetingPointId: string | null;
  lat: number;
  lng: number;
  capturedAt: Date;
  etaSeconds: number | null;
  etaComputedAt: Date | null;
  source: LocationSource;
  createdAt: Date;
}

export async function insertLocationSnapshot(input: {
  activityId: string;
  userId: string;
  meetingPointId: string | null;
  location: GeoPoint;
  capturedAt: Date;
  etaSeconds: number | null;
  etaComputedAt: Date | null;
  source: LocationSource;
}): Promise<LocationSnapshotRow> {
  const id = randomUUID();
  const rows = await prisma.$queryRaw<LocationSnapshotRow[]>`
    INSERT INTO location_snapshots
      (id, activity_id, user_id, meeting_point_id, location, captured_at, eta_seconds, eta_computed_at, source, created_at)
    VALUES (
      ${id}, ${input.activityId}, ${input.userId}, ${input.meetingPointId},
      ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326)::geography,
      ${input.capturedAt}, ${input.etaSeconds}, ${input.etaComputedAt}, ${input.source}::"LocationSource", now()
    )
    RETURNING ${LOCATION_SNAPSHOT_COLUMNS}
  `;
  return rows[0]!;
}

/** The most recent position one person reported during an activity. Covered by the
 * (activity_id, user_id, created_at DESC) index, so this stays a single index seek. */
export async function getLatestSnapshotForUser(
  activityId: string,
  userId: string,
): Promise<LocationSnapshotRow | null> {
  const rows = await prisma.$queryRaw<LocationSnapshotRow[]>`
    SELECT ${LOCATION_SNAPSHOT_COLUMNS} FROM location_snapshots
    WHERE activity_id = ${activityId} AND user_id = ${userId}
    ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getLatestSnapshotsForActivity(activityId: string): Promise<LocationSnapshotRow[]> {
  return prisma.$queryRaw<LocationSnapshotRow[]>`
    SELECT DISTINCT ON (user_id) ${LOCATION_SNAPSHOT_COLUMNS}
    FROM location_snapshots
    WHERE activity_id = ${activityId}
    ORDER BY user_id, created_at DESC
  `;
}
