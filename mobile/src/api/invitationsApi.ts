import type { Invitation, InvitationPreview, InviteMemberDto } from '@meetingpnt/shared';
import { apiFetch } from './client';

export const invitationsApi = {
  preview: (token: string) =>
    apiFetch<InvitationPreview>(`/api/invitations/${token}`, { skipAuth: true }),
  invite: (groupId: string, dto: InviteMemberDto) =>
    apiFetch<{ type: 'added' } | { type: 'invited'; invitation: Invitation }>(
      `/api/groups/${groupId}/invitations`,
      { method: 'POST', body: dto },
    ),
};
