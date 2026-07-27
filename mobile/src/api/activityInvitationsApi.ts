import type { ActivityGuestWithUser, Invitation, InviteMemberDto } from '@meetingpnt/shared';
import { apiFetch } from './client';

export const activityInvitationsApi = {
  invite: (activityId: string, dto: InviteMemberDto) =>
    apiFetch<{ type: 'added' } | { type: 'invited'; invitation: Invitation }>(
      `/api/activities/${activityId}/invitations`,
      { method: 'POST', body: dto },
    ),
  listGuests: (activityId: string) =>
    apiFetch<{ guests: ActivityGuestWithUser[] }>(`/api/activities/${activityId}/guests`),
};
