import type { ActivityGuestWithUser, Invitation, InviteMemberDto } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const activityInvitationsApi = {
  invite: (activityId: string, dto: InviteMemberDto) =>
    apiFetch<{ type: 'added' } | { type: 'invited'; invitation: Invitation }>(
      `/api/activities/${activityId}/invitations`,
      { method: 'POST', body: dto },
    ),
  listPending: (activityId: string) =>
    apiFetch<{ invitations: Invitation[] }>(`/api/activities/${activityId}/invitations`),
  listGuests: (activityId: string) =>
    apiFetch<{ guests: ActivityGuestWithUser[] }>(`/api/activities/${activityId}/guests`),
};
