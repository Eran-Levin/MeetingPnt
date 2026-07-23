import type { Rsvp, RsvpUpdateDto, RsvpWithUser } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const rsvpsApi = {
  upsert: (activityId: string, dto: RsvpUpdateDto) =>
    apiFetch<{ rsvp: Rsvp }>(`/api/activities/${activityId}/rsvp`, { method: 'POST', body: dto }),
  list: (activityId: string) =>
    apiFetch<{ rsvps: RsvpWithUser[] }>(`/api/activities/${activityId}/rsvps`),
};
