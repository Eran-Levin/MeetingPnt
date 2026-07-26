import type {
  Attendance as SharedAttendance,
  AttendanceWithUser,
  UpdateAttendanceDto,
} from '@meetingpnt/shared';
import type { Attendance, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';

function toSharedAttendance(record: Attendance): SharedAttendance {
  return {
    id: record.id,
    activityId: record.activityId,
    userId: record.userId,
    status: record.status,
    markedBy: record.markedBy,
    markedAt: record.markedAt.toISOString(),
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

export async function updateAttendance(
  activityId: string,
  requesterId: string,
  dto: UpdateAttendanceDto,
): Promise<AttendanceWithUser[]> {
  await assertActivityLeader(activityId, requesterId);

  await prisma.$transaction(
    dto.entries.map((entry) =>
      prisma.attendance.upsert({
        where: { activityId_userId: { activityId, userId: entry.userId } },
        create: { activityId, userId: entry.userId, status: entry.status, markedBy: requesterId },
        update: { status: entry.status, markedBy: requesterId, markedAt: new Date() },
      }),
    ),
  );

  return listAttendance(activityId, requesterId);
}

export async function listAttendance(
  activityId: string,
  requesterId: string,
): Promise<AttendanceWithUser[]> {
  await assertActivityLeader(activityId, requesterId);

  const records = await prisma.attendance.findMany({
    where: { activityId },
    include: { user: true },
    orderBy: { markedAt: 'desc' },
  });

  return records.map((record: Attendance & { user: User }) => ({
    ...toSharedAttendance(record),
    user: { id: record.user.id, name: record.user.name, email: record.user.email },
  }));
}
