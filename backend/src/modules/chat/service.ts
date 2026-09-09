import type { MessageWithAuthor, SendMessageDto } from '@meetingpnt/shared';
import { SocketEvents } from '@meetingpnt/shared';
import type { Message, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { displayName } from '../../lib/userName.js';
import { sendPushNotifications } from '../../lib/expoPushClient.js';
import { isSupportedImageMime, saveImage } from '../../lib/storage.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { getIO } from '../../realtime/index.js';

const MESSAGE_PAGE_SIZE = 50;

function toSharedMessage(message: Message & { author: User }): MessageWithAuthor {
  return {
    id: message.id,
    groupId: message.groupId,
    authorId: message.authorId,
    body: message.body,
    imageUrl: message.imageUrl,
    createdAt: message.createdAt.toISOString(),
    author: {
      id: message.author.id,
      name: displayName(message.author),
      email: message.author.email,
      avatarUrl: message.author.avatarUrl,
    },
  };
}

async function assertChatParticipant(groupId: string, userId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new HttpError(404, 'Group not found');
  }
  const isLeader = group.leaderId === userId;
  const isMember =
    isLeader ||
    !!(await prisma.groupMember.findFirst({ where: { groupId, userId, status: 'active' } }));
  if (!isMember) {
    throw new HttpError(403, 'Not a member of this group');
  }
  return { group, isLeader };
}

export async function listMessages(
  groupId: string,
  requesterId: string,
  params: { before?: string },
): Promise<MessageWithAuthor[]> {
  await assertChatParticipant(groupId, requesterId);

  const messages = await prisma.message.findMany({
    where: {
      groupId,
      ...(params.before ? { createdAt: { lt: new Date(params.before) } } : {}),
    },
    include: { author: true },
    orderBy: { createdAt: 'desc' },
    take: MESSAGE_PAGE_SIZE,
  });

  return messages.reverse().map(toSharedMessage);
}

export async function sendMessage(
  groupId: string,
  requesterId: string,
  dto: SendMessageDto,
  file: Express.Multer.File | undefined,
): Promise<MessageWithAuthor> {
  const { group, isLeader } = await assertChatParticipant(groupId, requesterId);

  if (!isLeader && group.chatMode === 'announcements') {
    throw new HttpError(403, 'Only the group leader can post in this group');
  }
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

  const created = await prisma.message.create({
    data: { groupId, authorId: requesterId, body: dto.body ?? null, imageUrl },
    include: { author: true },
  });
  const message = toSharedMessage(created);

  getIO().to(`group:${groupId}`).emit(SocketEvents.ChatMessage, { message });

  const recipients = await prisma.groupMember.findMany({
    where: { groupId, status: 'active', userId: { not: requesterId } },
    include: { user: { include: { pushTokens: true } } },
  });
  const tokens = recipients.flatMap((member) => member.user.pushTokens);
  await sendPushNotifications(
    tokens.map((token) => ({
      to: token.expoPushToken,
      title: `New message in ${group.name}`,
      body: dto.body ?? 'Sent a photo',
      data: { type: 'chat_message', groupId },
    })),
  );

  return message;
}
