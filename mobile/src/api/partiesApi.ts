import type { AddPartyMembersDto, Party } from '@meetingpnt/shared';
import { apiFetch } from './client';

export const partiesApi = {
  addMembers: (partyId: string, dto: AddPartyMembersDto) =>
    apiFetch<{ party: Party; members: unknown[] }>(`/api/parties/${partyId}/members`, {
      method: 'POST',
      body: dto,
    }),
};
