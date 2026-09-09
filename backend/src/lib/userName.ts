import type { User as SharedUser } from '@meetingpnt/shared';
import type { User } from '@prisma/client';

/**
 * Users are stored as a first and last name, but every screen shows one string. Deriving it in
 * one place keeps the two clients from formatting people differently — and means adding a middle
 * name or a display-name preference later is a single edit.
 */
export function displayName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

/** The full user as the clients receive it. Auth returns it on sign-in; the avatar upload returns
 * the updated one, so a client never has to guess what changed. */
export function toSharedUser(user: User): SharedUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: displayName(user),
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
