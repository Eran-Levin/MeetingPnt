import type { RsvpWithUser } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const rsvpsApi = {
  list: (activityId: string) =>
    apiFetch<{ rsvps: RsvpWithUser[] }>(`/api/activities/${activityId}/rsvps`),
};
