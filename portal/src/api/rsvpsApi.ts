import type { Rsvp, RsvpStatus, RsvpWithUser } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const rsvpsApi = {
  list: (activityId: string) =>
    apiFetch<{ rsvps: RsvpWithUser[] }>(`/api/activities/${activityId}/rsvps`),

  // Answering for someone who replied by phone or in person rather than in the app.
  setForMember: (activityId: string, userId: string, status: RsvpStatus) =>
    apiFetch<{ rsvp: Rsvp }>(`/api/activities/${activityId}/rsvps/${userId}`, {
      method: 'PUT',
      body: { status },
    }),
};
