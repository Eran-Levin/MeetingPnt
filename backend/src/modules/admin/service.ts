import type { Role } from '@meetingpnt/shared';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { toSharedUser } from '../../lib/userName.js';

export async function listUsers(params: { search?: string; role?: Role }) {
  const users = await prisma.user.findMany({
    where: {
      ...(params.role ? { role: params.role } : {}),
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: 'insensitive' } },
              { firstName: { contains: params.search, mode: 'insensitive' } },
              { lastName: { contains: params.search, mode: 'insensitive' } },
              { phone: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return users.map(toSharedUser);
}

export async function elevateUserRole(actorId: string, targetId: string, role: Role) {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    throw new HttpError(404, 'User not found');
  }

  const [updated] = await prisma.$transaction([
    prisma.user.update({ where: { id: targetId }, data: { role } }),
    prisma.auditLog.create({
      data: {
        actorId,
        targetId,
        action: 'role_change',
        fromValue: target.role,
        toValue: role,
      },
    }),
  ]);

  return toSharedUser(updated);
}
