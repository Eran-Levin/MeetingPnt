import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { GeoPoint, LocationSource } from '@meetingpnt/shared';
import { prisma } from './prisma.js';

const MEETING_POINT_COLUMNS = Prisma.sql`
  id, group_id AS "groupId", activity_id AS "activityId", label,
  ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
  is_primary AS "isPrimary", reconvene_time AS "reconveneTime",
  created_by AS "createdBy", created_at AS "createdAt"
`;

export interface MeetingPointRow {
  id: string;
  groupId: string;
  activityId: string | null;
  label: string | null;
  lat: number;
  lng: number;
  isPrimary: boolean;
  reconveneTime: Date | null;
  createdBy: string;
  createdAt: Date;
}

export async function insertMeetingPoint(input: {
  groupId: string;
  activityId: string | null;
  label?: string;
  location: GeoPoint;
  isPrimary: boolean;
  reconveneTime?: Date;
  createdBy: string;
}): Promise<MeetingPointRow> {
  const id = randomUUID();
  const rows = await prisma.$queryRaw<MeetingPointRow[]>`
    INSERT INTO meeting_points (id, group_id, activity_id, label, location, is_primary, reconvene_time, created_by, created_at)
    VALUES (
      ${id}, ${input.groupId}, ${input.activityId}, ${input.label ?? null},
      ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326)::geography,
      ${input.isPrimary}, ${input.reconveneTime ?? null}, ${input.createdBy}, now()
    )
    RETURNING ${MEETING_POINT_COLUMNS}
  `;
  return rows[0]!;
}

export async function listMeetingPoints(activityId: string): Promise<MeetingPointRow[]> {
  return prisma.$queryRaw<MeetingPointRow[]>`
    SELECT ${MEETING_POINT_COLUMNS} FROM meeting_points
    WHERE activity_id = ${activityId} ORDER BY created_at ASC
  `;
}

export async function getPrimaryMeetingPoint(activityId: string): Promise<MeetingPointRow | null> {
  const rows = await prisma.$queryRaw<MeetingPointRow[]>`
    SELECT ${MEETING_POINT_COLUMNS} FROM meeting_points
    WHERE activity_id = ${activityId} AND is_primary = true LIMIT 1
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
  input: { label?: string; location?: GeoPoint; reconveneTime?: Date | null },
): Promise<MeetingPointRow | null> {
  const sets: Prisma.Sql[] = [];
  if (input.label !== undefined) sets.push(Prisma.sql`label = ${input.label}`);
  if (input.location !== undefined) {
    sets.push(
      Prisma.sql`location = ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326)::geography`,
    );
  }
  if (input.reconveneTime !== undefined) {
    sets.push(Prisma.sql`reconvene_time = ${input.reconveneTime}`);
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
