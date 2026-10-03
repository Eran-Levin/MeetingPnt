import type { AddPartyMembersDto } from '@meetingpnt/shared';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../middleware/errorHandler.js';
import * as invitationsService from '../invitations/service.js';

async function assertPartyRep(partyId: string, requesterId: string) {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) {
    throw new HttpError(404, 'Party not found');
  }
  const requesterMembership = await prisma.groupMember.findFirst({
    where: { groupId: party.groupId, userId: requesterId, status: 'active' },
  });
  if (!requesterMembership || party.repMemberId !== requesterMembership.id) {
    throw new HttpError(403, 'Only the party representative can add party members');
  }
  return party;
}

/** The rep names the rest of their party, right after registering. Only the rep may do this, and
 * only until the party reaches the size the leader declared when inviting them. */
export async function addPartyMembers(partyId: string, requesterId: string, dto: AddPartyMembersDto) {
  const party = await assertPartyRep(partyId, requesterId);

  const currentCount = await prisma.groupMember.count({ where: { partyId } });
  if (currentCount >= party.size) {
    throw new HttpError(409, 'This party is already complete');
  }
  if (currentCount + dto.members.length !== party.size) {
    throw new HttpError(
      400,
      `This party needs exactly ${party.size - currentCount} more member(s)`,
    );
  }

  const members = [];
  for (const pm of dto.members) {
    members.push(await invitationsService.addPartyMember(party.groupId, partyId, requesterId, pm));
  }

  return { party: invitationsService.toSharedParty(party), members };
}
