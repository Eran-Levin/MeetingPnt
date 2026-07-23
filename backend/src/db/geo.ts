import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { GeoPoint, LocationSource } from '@meetingpnt/shared';
import { prisma } from './prisma.js';

const MEETING_POINT_COLUMNS = Prisma.sql`
  id, group_id AS "groupId", activity_id AS "activityId", label, google_maps_url AS "googleMapsUrl",
  ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
  time, created_by AS "createdBy", created_at AS "createdAt"
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
  createdBy: string;
}): Promise<MeetingPointRow> {
  const id = randomUUID();
  const rows = await prisma.$queryRaw<MeetingPointRow[]>`
    INSERT INTO meeting_points (id, group_id, activity_id, label, google_maps_url, location, time, created_by, created_at)
    VALUES (
      ${id}, ${input.groupId}, ${input.activityId}, ${input.label ?? null}, ${input.googleMapsUrl},
      ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326)::geography,
      ${input.time}, ${input.createdBy}, now()
    )
    RETURNING ${MEETING_POINT_COLUMNS}
  `;
  return rows[0]!;
}

export async function listMeetingPoints(activityId: string): Promise<MeetingPointRow[]> {
  return prisma.$queryRaw<MeetingPointRow[]>`
    SELECT ${MEETING_POINT_COLUMNS} FROM meeting_points
    WHERE activity_id = ${activityId} ORDER BY time ASC
  `;
}

/** The meeting point OMW/ping ETA should target: whichever time is soonest and hasn't passed yet. */
export async function getNextUpcomingMeetingPoint(activityId: string): Promise<MeetingPointRow | null> {
  const rows = await prisma.$queryRaw<MeetingPointRow[]>`
    SELECT ${MEETING_POINT_COLUMNS} FROM meeting_points
    WHERE activity_id = ${activityId} AND time >= now()
    ORDER BY time ASC LIMIT 1
  `;
  if (rows[0]) return rows[0];

  // All meeting points have passed — fall back to the most recent one rather than none at all.
  const fallback = await prisma.$queryRaw<MeetingPointRow[]>`
    SELECT ${MEETING_POINT_COLUMNS} FROM meeting_points
    WHERE activity_id = ${activityId}
    ORDER BY time DESC LIMIT 1
  `;
  return fallback[0] ?? null;
}

export async function getMeetingPointById(id: string): Promise<MeetingPointRow | null> {
  const rows = await prisma.$queryRaw<MeetingPointRow[]>`
    SELECT ${MEETING_POINT_COLUMNS} FROM meeting_points WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

export async function updateMeetingPoint(
  id: string,
  input: { label?: string; googleMapsUrl?: string; location?: GeoPoint; time?: Date },
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

export async function getLatestSnapshotsForActivity(activityId: string): Promise<LocationSnapshotRow[]> {
  return prisma.$queryRaw<LocationSnapshotRow[]>`
    SELECT DISTINCT ON (user_id) ${LOCATION_SNAPSHOT_COLUMNS}
    FROM location_snapshots
    WHERE activity_id = ${activityId}
    ORDER BY user_id, created_at DESC
  `;
}
