import { randomBytes, createHash } from 'node:crypto';
import type {
  InviteMemberDto,
  Invitation as SharedInvitation,
  InvitationPreview,
} from '@meetingpnt/shared';
import type { Invitation } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { sendInvitationEmail } from '../../lib/resendClient.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function toSharedInvitation(invitation: Invitation): SharedInvitation {
  return {
    id: invitation.id,
    groupId: invitation.groupId,
    activityId: invitation.activityId,
    email: invitation.email,
    status: invitation.status,
    invitedBy: invitation.invitedBy,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

async function assertGroupLeader(groupId: string, requesterId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new HttpError(404, 'Group not found');
  }
  if (group.leaderId !== requesterId) {
    throw new HttpError(403, 'Only the group leader can manage invitations');
  }
  return group;
}

export async function inviteMember(groupId: string, requesterId: string, dto: InviteMemberDto) {
  const group = await assertGroupLeader(groupId, requesterId);
  const inviter = await prisma.user.findUnique({ where: { id: requesterId } });

  const existingUser = await prisma.user.findUnique({ where: { email: dto.email } });

  if (existingUser) {
    const existingMembership = await prisma.groupMember.findFirst({
      where: { groupId, userId: existingUser.id },
    });

    if (existingMembership) {
      if (existingMembership.status === 'active') {
        throw new HttpError(409, 'This person is already a member of the group');
      }
      await prisma.groupMember.update({
        where: { id: existingMembership.id },
        data: { status: 'active' },
      });
    } else {
      await prisma.groupMember.create({
        data: { groupId, userId: existingUser.id, status: 'active' },
      });
    }

    return { type: 'added' as const };
  }

  const rawToken = randomBytes(32).toString('hex');
  const invitation = await prisma.invitation.create({
    data: {
      groupId,
      email: dto.email,
      tokenHash: hashToken(rawToken),
      invitedBy: requesterId,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });

  const acceptUrl = `${env.MOBILE_DEEP_LINK_SCHEME}://accept-invite?token=${rawToken}`;
  await sendInvitationEmail({
    to: dto.email,
    groupName: group.name,
    inviterName: inviter?.name ?? 'A MeetingPnt leader',
    acceptUrl,
  });

  return { type: 'invited' as const, invitation: toSharedInvitation(invitation) };
}

/** Invites someone to a single activity without giving them full group membership ("visitor"). */
export async function inviteActivityGuest(
  activityId: string,
  requesterId: string,
  dto: InviteMemberDto,
) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  const group = await assertGroupLeader(activity.groupId, requesterId);
  const inviter = await prisma.user.findUnique({ where: { id: requesterId } });

  const existingUser = await prisma.user.findUnique({ where: { email: dto.email } });

  if (existingUser) {
    const activeMembership = await prisma.groupMember.findFirst({
      where: { groupId: activity.groupId, userId: existingUser.id, status: 'active' },
    });
    if (activeMembership) {
      throw new HttpError(409, 'This person is already a member of the group');
    }

    await prisma.activityGuest.upsert({
      where: { activityId_userId: { activityId, userId: existingUser.id } },
      create: { activityId, userId: existingUser.id, invitedBy: requesterId },
      update: {},
    });

    return { type: 'added' as const };
  }

  const rawToken = randomBytes(32).toString('hex');
  const invitation = await prisma.invitation.create({
    data: {
      groupId: activity.groupId,
      activityId,
      email: dto.email,
      tokenHash: hashToken(rawToken),
      invitedBy: requesterId,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });

  const acceptUrl = `${env.MOBILE_DEEP_LINK_SCHEME}://accept-invite?token=${rawToken}`;
  await sendInvitationEmail({
    to: dto.email,
    groupName: `${group.name} — ${activity.title}`,
    inviterName: inviter?.name ?? 'A MeetingPnt leader',
    acceptUrl,
  });

  return { type: 'invited' as const, invitation: toSharedInvitation(invitation) };
}

export async function listActivityGuests(activityId: string, requesterId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  await assertGroupLeader(activity.groupId, requesterId);

  const guests = await prisma.activityGuest.findMany({
    where: { activityId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  return guests.map((g) => ({
    id: g.id,
    activityId: g.activityId,
    userId: g.userId,
    invitedBy: g.invitedBy,
    createdAt: g.createdAt.toISOString(),
    user: { id: g.user.id, name: g.user.name, email: g.user.email },
  }));
}

export async function listPendingInvitations(groupId: string, requesterId: string) {
  await assertGroupLeader(groupId, requesterId);
  const invitations = await prisma.invitation.findMany({
    where: { groupId, activityId: null, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
  return invitations.map(toSharedInvitation);
}

export async function listPendingActivityInvitations(activityId: string, requesterId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, 'Activity not found');
  }
  await assertGroupLeader(activity.groupId, requesterId);
  const invitations = await prisma.invitation.findMany({
    where: { activityId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
  return invitations.map(toSharedInvitation);
}

export async function revokeInvitation(invitationId: string, requesterId: string) {
  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation) {
    throw new HttpError(404, 'Invitation not found');
  }
  await assertGroupLeader(invitation.groupId, requesterId);
  await prisma.invitation.update({ where: { id: invitationId }, data: { status: 'revoked' } });
}

export async function previewInvitation(rawToken: string): Promise<InvitationPreview> {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { group: true },
  });

  if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
    throw new HttpError(410, 'This invitation link is invalid or has expired');
  }

  return { email: invitation.email, group: { id: invitation.group.id, name: invitation.group.name } };
}

/** Called from the auth register flow. Validates and consumes the token, joining the new user
 * to the group (or, for an activity-scoped invite, adding them as a guest of just that activity). */
export async function consumeInvitation(rawToken: string, registeredEmail: string, userId: string) {
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(rawToken) } });

  if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
    return;
  }
  if (invitation.email.toLowerCase() !== registeredEmail.toLowerCase()) {
    return;
  }

  if (invitation.activityId) {
    await prisma.$transaction([
      prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'accepted' } }),
      prisma.activityGuest.upsert({
        where: { activityId_userId: { activityId: invitation.activityId, userId } },
        create: { activityId: invitation.activityId, userId, invitedBy: invitation.invitedBy },
        update: {},
      }),
    ]);
    return;
  }

  await prisma.$transaction([
    prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'accepted' } }),
    prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: invitation.groupId, userId } },
      create: { groupId: invitation.groupId, userId, status: 'active' },
      update: { status: 'active' },
    }),
  ]);
}
