import type { LoginDto, RegisterDto, User as SharedUser } from '@meetingpnt/shared';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { parseDurationMs } from '../../lib/duration.js';
import { signAccessToken } from '../../lib/jwt.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { generateRefreshToken, hashRefreshToken } from '../../lib/refreshToken.js';
import { consumeInvitation } from '../invitations/service.js';
import { displayName } from '../../lib/userName.js';
import type { User } from '@prisma/client';

function toSharedUser(user: User): SharedUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: displayName(user),
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function issueTokens(user: User) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const { raw, hash } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN)),
    },
  });

  return { accessToken, refreshToken: raw };
}

export async function register(input: RegisterDto) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      role: 'user',
    },
  });

  if (input.invitationToken) {
    await consumeInvitation(input.invitationToken, user.email, user.id);
  }

  const tokens = await issueTokens(user);
  return { user: toSharedUser(user), ...tokens };
}

export async function login(input: LoginDto) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const tokens = await issueTokens(user);
  return { user: toSharedUser(user), ...tokens };
}

export async function refresh(rawToken: string) {
  const tokenHash = hashRefreshToken(rawToken);
  const stored = await prisma.refreshToken.findFirst({ where: { tokenHash } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    if (stored && !stored.revokedAt) {
      // Reuse of an already-issued token past rotation is treated as compromise:
      // revoke the whole family for this user.
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    throw new HttpError(401, 'Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) {
    throw new HttpError(401, 'Invalid or expired refresh token');
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokens(user);
  return { user: toSharedUser(user), ...tokens };
}

export async function logout(rawToken: string) {
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, 'User not found');
  }
  return toSharedUser(user);
}
