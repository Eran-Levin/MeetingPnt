import { randomUUID } from 'node:crypto';
import type {
  CreateGroupDto,
  DuplicateGroupDto,
  Group as SharedGroup,
  GroupMemberWithUser,
  GroupWithRole,
  UpdateGroupDto,
} from '@meetingpnt/shared';
import type { Group, GroupMember, Party, User } from '@prisma/client';
import { copyMeetingPoints } from '../../db/geo.js';
import { prisma } from '../../db/prisma.js';
import { assertTimeZone, shiftDays } from '../../lib/shiftDays.js';
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

function toSharedMember(
  member: GroupMember & { user: User; party: Party | null },
): GroupMemberWithUser {
  return {
    id: member.id,
    groupId: member.groupId,
    userId: member.userId,
    partyId: member.partyId,
    status: member.status,
    joinedAt: member.joinedAt.toISOString(),
    user: {
      id: member.user.id,
      name: displayName(member.user),
      email: member.user.email,
      phone: member.user.phone,
      avatarUrl: member.user.avatarUrl,
      isPlaceholder: member.user.isPlaceholder,
    },
    party: member.party
      ? { id: member.party.id, name: member.party.name, isRep: member.party.repMemberId === member.id }
      : null,
  };
}

export async function assertMembership(groupId: string, userId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new HttpError(404, 'group_not_found');
  }
  if (group.leaderId === userId) {
    return group;
  }
  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId, status: 'active' },
  });
  if (!membership) {
    throw new HttpError(403, 'not_group_member');
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

/**
 * A new group started from one the leader already runs. Two independent choices:
 *
 * - **Roster** — the same people carrying on (2025 into 2026). Active members only, with their
 *   parties; pending invitations and removed members stay behind. They're added directly, as the
 *   leader already vetted them once.
 * - **Events** — the same trip run again. Every non-cancelled event comes across as a draft, moved
 *   `shiftDays` days, with its stops. RSVPs, attendance, guests, chat and progress stay behind,
 *   and a recurring series stays a series.
 *
 * Nothing is announced: events are drafts, so no member hears of them until the leader publishes.
 */
export async function duplicateGroup(
  sourceId: string,
  leaderId: string,
  dto: DuplicateGroupDto,
): Promise<SharedGroup> {
  const source = await prisma.group.findUnique({ where: { id: sourceId } });
  if (!source) {
    throw new HttpError(404, 'group_not_found');
  }
  if (source.leaderId !== leaderId) {
    throw new HttpError(403, 'leader_only_duplicate_group');
  }

  const timeZone = dto.timeZone ?? 'UTC';
  const shift = dto.shiftDays ?? 0;
  try {
    assertTimeZone(timeZone);
  } catch {
    throw new HttpError(400, 'invalid_time_zone');
  }

  const created = await prisma.group.create({
    data: {
      name: dto.name,
      description: dto.description,
      chatMode: source.chatMode,
      leaderId,
      members: { create: { userId: leaderId, status: 'active' } },
    },
  });

  try {
    if (dto.copyRoster) {
      await copyRoster(sourceId, created.id, leaderId);
    }
    if (dto.copyEvents) {
      await copyEvents(sourceId, created.id, leaderId, shift, timeZone);
    }
  } catch (err) {
    // Half a copy is worse than none: the leader would find a group with some of the roster or
    // some of the days and no way to tell what's missing.
    await prisma.group.delete({ where: { id: created.id } }).catch(() => undefined);
    throw err;
  }

  return toSharedGroup(created);
}

async function copyRoster(sourceId: string, targetId: string, leaderId: string) {
  const members = await prisma.groupMember.findMany({
    where: { groupId: sourceId, status: 'active', userId: { not: leaderId } },
    orderBy: { joinedAt: 'asc' },
    include: { party: true },
  });
  if (members.length === 0) return;

  await prisma.$transaction(async (tx) => {
    // Rows are created one by one so joinedAt keeps the source order, and so each party can
    // point at its rep's new membership row.
    const newMemberByUser = new Map<string, string>();
    const newPartyBySource = new Map<string, string>();

    for (const member of members) {
      let partyId: string | null = null;
      if (member.party) {
        partyId = newPartyBySource.get(member.party.id) ?? null;
        if (!partyId) {
          const party = await tx.party.create({
            data: { groupId: targetId, name: member.party.name, size: member.party.size },
          });
          newPartyBySource.set(member.party.id, party.id);
          partyId = party.id;
        }
      }
      const row = await tx.groupMember.create({
        data: { groupId: targetId, userId: member.userId, partyId, status: 'active' },
      });
      newMemberByUser.set(member.userId, row.id);
    }

    // The rep is a membership row in the source group; find who that was and map to the new row.
    // A rep who has since been removed leaves the copied party without one.
    const sourceByMemberId = new Map(members.map((m) => [m.id, m]));
    for (const [sourcePartyId, newPartyId] of newPartyBySource) {
      const sourceParty = members.find((m) => m.party?.id === sourcePartyId)!.party!;
      const rep = sourceParty.repMemberId ? sourceByMemberId.get(sourceParty.repMemberId) : null;
      if (rep) {
        await tx.party.update({
          where: { id: newPartyId },
          data: { repMemberId: newMemberByUser.get(rep.userId) },
        });
      }
    }
  });
}

async function copyEvents(
  sourceId: string,
  targetId: string,
  leaderId: string,
  shiftDaysBy: number,
  timeZone: string,
) {
  const events = await prisma.activity.findMany({
    where: { groupId: sourceId, status: { not: 'cancelled' } },
    orderBy: { startAt: 'asc' },
  });
  if (events.length === 0) return;

  // A series stays a series, under a new id so "publish all" on the copy can't touch the original.
  const newSeriesId = new Map<string, string>();
  const copies = events.map((event) => {
    const startAt = shiftDays(event.startAt, shiftDaysBy, timeZone);
    const endAt = shiftDays(event.endAt, shiftDaysBy, timeZone);
    let seriesId: string | null = null;
    if (event.seriesId) {
      seriesId = newSeriesId.get(event.seriesId) ?? randomUUID();
      newSeriesId.set(event.seriesId, seriesId);
    }
    return { event, id: randomUUID(), seriesId, startAt, endAt };
  });

  await prisma.activity.createMany({
    data: copies.map(({ event, id, seriesId, startAt, endAt }) => ({
      id,
      groupId: targetId,
      seriesId,
      title: event.title,
      description: event.description,
      startAt,
      endAt,
      allDay: event.allDay,
      transportMode: event.transportMode,
      requiresRsvp: event.requiresRsvp,
      singleLocation: event.singleLocation,
      status: 'draft' as const,
      createdBy: leaderId,
    })),
  });

  for (const { event, id, startAt } of copies) {
    await copyMeetingPoints({
      fromActivityId: event.id,
      toActivityId: id,
      toGroupId: targetId,
      createdBy: leaderId,
      // Each stop keeps its distance from the start, even if the clock shifted across a DST change.
      deltaMs: startAt.getTime() - event.startAt.getTime(),
    });
  }
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
    throw new HttpError(404, 'group_not_found');
  }
  if (group.leaderId !== requesterId) {
    throw new HttpError(403, 'leader_only_update_group');
  }
  const updated = await prisma.group.update({ where: { id: groupId }, data: dto });
  const ranEvents = await groupIdsWithRunEvents([groupId]);
  return toSharedGroup(updated, ranEvents.has(groupId));
}

export async function deleteGroup(groupId: string, requesterId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new HttpError(404, 'group_not_found');
  }
  if (group.leaderId !== requesterId) {
    throw new HttpError(403, 'leader_only_delete_group');
  }
  await prisma.group.delete({ where: { id: groupId } });
}

export async function listMembers(groupId: string, requesterId: string) {
  await assertMembership(groupId, requesterId);
  const members = await prisma.groupMember.findMany({
    where: { groupId, status: 'active' },
    include: { user: true, party: true },
    orderBy: { joinedAt: 'asc' },
  });
  return members.map(toSharedMember);
}

export async function removeMember(groupId: string, targetUserId: string, requesterId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new HttpError(404, 'group_not_found');
  }
  if (group.leaderId !== requesterId) {
    throw new HttpError(403, 'leader_only_remove_members');
  }
  if (targetUserId === group.leaderId) {
    throw new HttpError(400, 'leader_cannot_be_removed');
  }

  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId: targetUserId },
  });
  if (!membership) {
    throw new HttpError(404, 'member_not_found');
  }

  await prisma.groupMember.update({ where: { id: membership.id }, data: { status: 'removed' } });
}
