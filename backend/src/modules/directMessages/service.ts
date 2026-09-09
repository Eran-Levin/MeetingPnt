import type { DirectMessage as SharedDirectMessage, DirectThread, SendMessageDto } from '@meetingpnt/shared';
import type { DirectMessage } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { sendPushNotifications } from '../../lib/expoPushClient.js';
import { isSupportedImageMime, saveImage } from '../../lib/storage.js';
import { displayName } from '../../lib/userName.js';
import { HttpError } from '../../middleware/errorHandler.js';

const THREAD_PAGE_SIZE = 50;

function toSharedDirectMessage(message: DirectMessage): SharedDirectMessage {
  return {
    id: message.id,
    senderId: message.senderId,
    recipientId: message.recipientId,
    body: message.body,
    imageUrl: message.imageUrl,
    createdAt: message.createdAt.toISOString(),
  };
}

/** The groups and one-off activities a person is attached to — the two ways they meet anyone. */
async function contextOf(userId: string) {
  const [led, memberships, guestOf] = await Promise.all([
    prisma.group.findMany({ where: { leaderId: userId }, select: { id: true } }),
    prisma.groupMember.findMany({ where: { userId, status: 'active' }, select: { groupId: true } }),
    prisma.activityGuest.findMany({ where: { userId }, select: { activityId: true } }),
  ]);
  return {
    groupIds: new Set([...led.map((g) => g.id), ...memberships.map((m) => m.groupId)]),
    guestActivityIds: new Set(guestOf.map((g) => g.activityId)),
  };
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  for (const value of a) if (b.has(value)) return true;
  return false;
}

/** True when `guestActivityIds` reaches an activity the other person is in through their group. */
async function guestSharesActivity(
  guestActivityIds: Set<string>,
  otherGroupIds: Set<string>,
): Promise<boolean> {
  if (guestActivityIds.size === 0 || otherGroupIds.size === 0) return false;
  const count = await prisma.activity.count({
    where: { id: { in: [...guestActivityIds] }, groupId: { in: [...otherGroupIds] } },
  });
  return count > 0;
}

/**
 * You can message someone the app has already put you in a room with — a group you're both on, or
 * an activity you're both attending. Nothing broader: a direct thread is for coordinating a lift
 * to Tuesday's walk, not a way to reach a stranger whose name appeared once in an attendee list.
 */
async function assertReachable(requesterId: string, otherId: string) {
  if (requesterId === otherId) {
    throw new HttpError(400, "You can't message yourself");
  }

  const other = await prisma.user.findUnique({ where: { id: otherId } });
  if (!other) {
    throw new HttpError(404, 'User not found');
  }

  const [mine, theirs] = await Promise.all([contextOf(requesterId), contextOf(otherId)]);

  const reachable =
    intersects(mine.groupIds, theirs.groupIds) ||
    intersects(mine.guestActivityIds, theirs.guestActivityIds) ||
    (await guestSharesActivity(mine.guestActivityIds, theirs.groupIds)) ||
    (await guestSharesActivity(theirs.guestActivityIds, mine.groupIds));

  if (!reachable) {
    throw new HttpError(403, "You don't share a group or an activity with this person");
  }

  return other;
}

export async function getThread(
  requesterId: string,
  otherId: string,
  params: { before?: string },
): Promise<DirectThread> {
  const other = await assertReachable(requesterId, otherId);

  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [
        { senderId: requesterId, recipientId: otherId },
        { senderId: otherId, recipientId: requesterId },
      ],
      ...(params.before ? { createdAt: { lt: new Date(params.before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: THREAD_PAGE_SIZE,
  });

  return {
    withUser: { id: other.id, name: displayName(other), avatarUrl: other.avatarUrl },
    messages: messages.reverse().map(toSharedDirectMessage),
  };
}

export async function sendDirectMessage(
  requesterId: string,
  otherId: string,
  dto: SendMessageDto,
  file: Express.Multer.File | undefined,
): Promise<SharedDirectMessage> {
  const other = await assertReachable(requesterId, otherId);

  if (!dto.body && !file) {
    throw new HttpError(400, 'A message needs text or an image');
  }

  let imageUrl: string | null = null;
  if (file) {
    if (!isSupportedImageMime(file.mimetype)) {
      throw new HttpError(400, 'Unsupported image type — use JPEG, PNG, or WebP');
    }
    imageUrl = await saveImage(file.buffer, file.mimetype);
  }

  const created = await prisma.directMessage.create({
    data: { senderId: requesterId, recipientId: otherId, body: dto.body ?? null, imageUrl },
  });

  const sender = await prisma.user.findUnique({ where: { id: requesterId } });
  const tokens = await prisma.pushToken.findMany({ where: { userId: other.id } });
  await sendPushNotifications(
    tokens.map((token) => ({
      to: token.expoPushToken,
      title: sender ? displayName(sender) : 'New message',
      body: dto.body ?? 'Sent a photo',
      data: { type: 'direct_message', userId: requesterId },
    })),
  );

  return toSharedDirectMessage(created);
}
