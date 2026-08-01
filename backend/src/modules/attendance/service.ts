import type {
  ActivityParticipation,
  Attendance as SharedAttendance,
  AttendanceWithUser,
  RollCallEntry,
  UpdateAttendanceDto,
} from '@meetingpnt/shared';
import type { Attendance, User } from '@prisma/client';
import { getMeetingPointById, listMeetingPoints } from '../../db/geo.js';
import { prisma } from '../../db/prisma.js';
import { displayName } from '../../lib/userName.js';
import { HttpError } from '../../middleware/errorHandler.js';

function toSharedAttendance(record: Attendance): SharedAttendance {
  return {
    id: record.id,
    meetingPointId: record.meetingPointId,
    userId: record.userId,
    status: record.status,
    markedBy: record.markedBy,
    markedAt: record.markedAt.toISOString(),
  };
}

function withUser(record: Attendance & { user: User }): AttendanceWithUser {
  return {
    ...toSharedAttendance(record),
    user: { id: record.user.id, name: displayName(record.user), email: record.user.email },
  };
}

async function assertActivityLeader(activityId: string, requesterId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  const group = await prisma.group.findUnique({ where: { id: activity.groupId } });
  if (!group || group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can manage attendance');
  }
  return activity;
}

/** Resolves the meeting point and checks the caller leads the activity it belongs to. */
async function assertMeetingPointLeader(meetingPointId: string, requesterId: string) {
  const meetingPoint = await getMeetingPointById(meetingPointId);
  if (!meetingPoint || !meetingPoint.activityId) {
    throw new HttpError(404, 'Meeting point not found');
  }
  await assertActivityLeader(meetingPoint.activityId, requesterId);
  return meetingPoint;
}

export async function updateAttendance(
  meetingPointId: string,
  requesterId: string,
  dto: UpdateAttendanceDto,
): Promise<AttendanceWithUser[]> {
  await assertMeetingPointLeader(meetingPointId, requesterId);

  await prisma.$transaction(
    dto.entries.map((entry) =>
      prisma.attendance.upsert({
        where: { meetingPointId_userId: { meetingPointId, userId: entry.userId } },
        create: { meetingPointId, userId: entry.userId, status: entry.status, markedBy: requesterId },
        update: { status: entry.status, markedBy: requesterId, markedAt: new Date() },
      }),
    ),
  );

  return listAttendance(meetingPointId, requesterId);
}

export async function listAttendance(
  meetingPointId: string,
  requesterId: string,
): Promise<AttendanceWithUser[]> {
  await assertMeetingPointLeader(meetingPointId, requesterId);

  const records = await prisma.attendance.findMany({
    where: { meetingPointId },
    include: { user: true },
    orderBy: { markedAt: 'desc' },
  });
  return records.map(withUser);
}

/** Every attendance record across an activity's meeting points, keyed by meeting point. */
export async function listActivityAttendance(
  activityId: string,
  requesterId: string,
): Promise<Record<string, AttendanceWithUser[]>> {
  await assertActivityLeader(activityId, requesterId);

  const meetingPoints = await listMeetingPoints(activityId);
  if (meetingPoints.length === 0) return {};

  const records = await prisma.attendance.findMany({
    where: { meetingPointId: { in: meetingPoints.map((mp) => mp.id) } },
    include: { user: true },
    orderBy: { markedAt: 'desc' },
  });

  const byMeetingPoint: Record<string, AttendanceWithUser[]> = {};
  for (const mp of meetingPoints) byMeetingPoint[mp.id] = [];
  for (const record of records) byMeetingPoint[record.meetingPointId]?.push(withUser(record));
  return byMeetingPoint;
}

/**
 * Who the leader should be looking for at this meeting point, with their RSVP and whether
 * they've been ticked off yet.
 *
 * The roster narrows as the group moves. At the first meeting point it's everyone who hasn't
 * declined — members and visitors alike. At every later point it's only the people who were
 * actually present at the previous one, so a leader who has moved on isn't still chasing
 * someone who went home.
 */
export async function getRollCall(
  meetingPointId: string,
  requesterId: string,
): Promise<RollCallEntry[]> {
  const meetingPoint = await assertMeetingPointLeader(meetingPointId, requesterId);
  const activityId = meetingPoint.activityId!;

  const points = await listMeetingPoints(activityId);
  const index = points.findIndex((p) => p.id === meetingPointId);
  const previous = index > 0 ? points[index - 1] : undefined;

  const [rsvps, guests, attendanceHere, attendanceBefore] = await Promise.all([
    prisma.rsvp.findMany({ where: { activityId }, include: { user: true } }),
    prisma.activityGuest.findMany({ where: { activityId }, include: { user: true } }),
    prisma.attendance.findMany({ where: { meetingPointId } }),
    previous
      ? prisma.attendance.findMany({ where: { meetingPointId: previous.id, status: 'present' } })
      : Promise.resolve([]),
  ]);

  const guestIds = new Set(guests.map((g) => g.userId));
  const rsvpByUser = new Map(rsvps.map((r) => [r.userId, r]));
  const attendanceByUser = new Map(attendanceHere.map((a) => [a.userId, a.status]));

  // Everyone who could plausibly be here, before narrowing.
  const candidates = new Map<string, User>();
  for (const rsvp of rsvps) candidates.set(rsvp.userId, rsvp.user);
  for (const guest of guests) candidates.set(guest.userId, guest.user);

  const carriedForward = new Set(attendanceBefore.map((a) => a.userId));

  return [...candidates.values()]
    .filter((user) => {
      if (previous) return carriedForward.has(user.id);
      return rsvpByUser.get(user.id)?.status !== 'declined';
    })
    .map((user) => ({
      user: { id: user.id, name: displayName(user), email: user.email },
      isVisitor: guestIds.has(user.id),
      rsvpStatus: rsvpByUser.get(user.id)?.status ?? 'pending',
      attendance: attendanceByUser.get(user.id) ?? null,
    }))
    .sort((a, b) => {
      // Unmarked first — they're the ones still needing a decision.
      if ((a.attendance === null) !== (b.attendance === null)) return a.attendance === null ? -1 : 1;
      return a.user.name.localeCompare(b.user.name);
    });
}

/** Activity-level participation, derived rather than stored: present at any meeting point
 * counts as having attended, which keeps single-point activities behaving as before. */
export async function listActivityParticipation(
  activityId: string,
  requesterId: string,
): Promise<ActivityParticipation[]> {
  await assertActivityLeader(activityId, requesterId);

  const meetingPoints = await listMeetingPoints(activityId);
  const records =
    meetingPoints.length > 0
      ? await prisma.attendance.findMany({
          where: { meetingPointId: { in: meetingPoints.map((mp) => mp.id) }, status: 'present' },
          include: { user: true },
        })
      : [];

  const byUser = new Map<string, { user: User; presentCount: number }>();
  for (const record of records) {
    const existing = byUser.get(record.userId);
    if (existing) existing.presentCount += 1;
    else byUser.set(record.userId, { user: record.user, presentCount: 1 });
  }

  return [...byUser.values()]
    .map(({ user, presentCount }) => ({
      user: { id: user.id, name: displayName(user), email: user.email },
      attended: presentCount > 0,
      presentCount,
      totalMeetingPoints: meetingPoints.length,
    }))
    .sort((a, b) => a.user.name.localeCompare(b.user.name));
}
