import type { Invitation, InviteMemberDto } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const invitationsApi = {
  invite: (groupId: string, dto: InviteMemberDto) =>
    apiFetch<{ type: 'added' } | { type: 'invited'; invitation: Invitation }>(
      `/api/groups/${groupId}/invitations`,
      { method: 'POST', body: dto },
    ),
  listPending: (groupId: string) =>
    apiFetch<{ invitations: Invitation[] }>(`/api/groups/${groupId}/invitations`),
  revoke: (invitationId: string) =>
    apiFetch<void>(`/api/invitations/${invitationId}`, { method: 'DELETE' }),
};
