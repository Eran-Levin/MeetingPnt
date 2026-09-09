import type {
  CreateGroupDto,
  Group as SharedGroup,
  GroupMemberWithUser,
  GroupWithRole,
  UpdateGroupDto,
} from '@meetingpnt/shared';
import type { Group, GroupMember, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { displayName } from '../../lib/userName.js';
import { HttpError } from '../../middleware/errorHandler.js';

const STATUS_ORDER: Record<Group['status'], number> = {
  planned: 0,
  in_progress: 1,
  completed: 2,
};

/**
 * Planned vs in progress is a fact about the group's events, not something worth asking the
 * leader to keep in sync by hand — once an event has run, the group is under way. Only
 * `completed` stays the leader's own call: closing a group means they're done with it, which
 * no amount of event history can tell us (a weekly class has run plenty of events and is very
 * much still open).
 */
function deriveStatus(stored: Group['status'], hasRunAnEvent: boolean): Group['status'] {
  if (stored === 'completed') return 'completed';
  return hasRunAnEvent ? 'in_progress' : 'planned';
}

async function groupIdsWithRunEvents(groupIds: string[]): Promise<Set<string>> {
  if (groupIds.length === 0) return new Set();
  const rows = await prisma.activity.groupBy({
    by: ['groupId'],
    where: { groupId: { in: groupIds }, status: { in: ['in_progress', 'completed'] } },
  });
  return new Set(rows.map((row) => row.groupId));
}

function toSharedGroup(group: Group, hasRunAnEvent = false): SharedGroup {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    status: deriveStatus(group.status, hasRunAnEvent),
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
    user: {
      id: member.user.id,
      name: displayName(member.user),
      email: member.user.email,
      phone: member.user.phone,
      avatarUrl: member.user.avatarUrl,
    },
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

  // One grouped query rather than a per-group lookup, so the list stays a single round trip.
  const nextStarts = await prisma.activity.groupBy({
    by: ['groupId'],
    where: {
      groupId: { in: groups.map((g) => g.id) },
      endAt: { gte: new Date() },
      status: { in: ['published', 'in_progress'] },
    },
    _min: { startAt: true },
  });
  const nextByGroup = new Map(nextStarts.map((row) => [row.groupId, row._min.startAt]));
  const ranEvents = await groupIdsWithRunEvents(groups.map((g) => g.id));

  const withStatus = groups.map((group) => ({
    ...toSharedGroup(group, ranEvents.has(group.id)),
    isLeader: group.leaderId === userId,
    nextActivityAt: nextByGroup.get(group.id)?.toISOString() ?? null,
  }));

  // Sorted on the derived status, so the list order matches the badge the leader actually sees.
  return withStatus.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

export async function getGroup(groupId: string, requesterId: string) {
  const group = await assertMembership(groupId, requesterId);
  const ranEvents = await groupIdsWithRunEvents([group.id]);
  return toSharedGroup(group, ranEvents.has(group.id));
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
  const ranEvents = await groupIdsWithRunEvents([groupId]);
  return toSharedGroup(updated, ranEvents.has(groupId));
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
