import type {
  CreateGroupDto,
  Group as SharedGroup,
  GroupMemberWithUser,
  GroupWithRole,
  UpdateGroupDto,
} from '@meetingpnt/shared';
import type { Group, GroupMember, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';

const STATUS_ORDER: Record<Group['status'], number> = {
  planned: 0,
  in_progress: 1,
  completed: 2,
};

function toSharedGroup(group: Group): SharedGroup {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    status: group.status,
    chatMode: group.chatMode,
    leaderId: group.leaderId,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

function toSharedMember(member: GroupMember & { user: User }): GroupMemberWithUser {
  return {
    id: member.id,
    groupId: member.groupId,
    userId: member.userId,
    status: member.status,
    joinedAt: member.joinedAt.toISOString(),
    user: { id: member.user.id, name: member.user.name, email: member.user.email },
  };
}

export async function assertMembership(groupId: string, userId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new HttpError(404, 'Group not found');
  }
  if (group.leaderId === userId) {
    return group;
  }
  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId, status: 'active' },
  });
  if (!membership) {
    throw new HttpError(403, 'Not a member of this group');
  }
  return group;
}

export async function createGroup(leaderId: string, dto: CreateGroupDto) {
  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.group.create({
      data: { name: dto.name, description: dto.description, leaderId },
    });
    await tx.groupMember.create({
      data: { groupId: created.id, userId: leaderId, status: 'active' },
    });
    return created;
  });
  return toSharedGroup(group);
}

export async function listMyGroups(userId: string): Promise<GroupWithRole[]> {
  const groups = await prisma.group.findMany({
    where: {
      OR: [{ leaderId: userId }, { members: { some: { userId, status: 'active' } } }],
    },
    orderBy: { createdAt: 'desc' },
  });
  const sorted = [...groups].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  return sorted.map((group) => ({ ...toSharedGroup(group), isLeader: group.leaderId === userId }));
}

export async function getGroup(groupId: string, requesterId: string) {
  const group = await assertMembership(groupId, requesterId);
  return toSharedGroup(group);
}

export async function updateGroup(groupId: string, requesterId: string, dto: UpdateGroupDto) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new HttpError(404, 'Group not found');
  }
  if (group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can update this group');
  }
  const updated = await prisma.group.update({ where: { id: groupId }, data: dto });
  return toSharedGroup(updated);
}

export async function deleteGroup(groupId: string, requesterId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new HttpError(404, 'Group not found');
  }
  if (group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can delete this group');
  }
  await prisma.group.delete({ where: { id: groupId } });
}

export async function listMembers(groupId: string, requesterId: string) {
  await assertMembership(groupId, requesterId);
  const members = await prisma.groupMember.findMany({
    where: { groupId, status: 'active' },
    include: { user: true },
    orderBy: { joinedAt: 'asc' },
  });
  return members.map(toSharedMember);
}

export async function removeMember(groupId: string, targetUserId: string, requesterId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new HttpError(404, 'Group not found');
  }
  if (group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can remove members');
  }
  if (targetUserId === group.leaderId) {
    throw new HttpError(400, 'The group leader cannot be removed');
  }

  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId: targetUserId },
  });
  if (!membership) {
    throw new HttpError(404, 'Member not found');
  }

  await prisma.groupMember.update({ where: { id: membership.id }, data: { status: 'removed' } });
}
