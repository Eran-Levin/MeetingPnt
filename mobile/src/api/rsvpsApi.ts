import type { Rsvp, RsvpUpdateDto, RsvpWithUser } from '@meetingpnt/shared';
import { apiFetch } from './client';

export const rsvpsApi = {
  upsert: (activityId: string, dto: RsvpUpdateDto) =>
    apiFetch<{ rsvp: Rsvp }>(`/api/activities/${activityId}/rsvp`, { method: 'POST', body: dto }),
  getMine: (activityId: string) =>
    apiFetch<{ rsvp: Rsvp | null }>(`/api/activities/${activityId}/rsvp/me`),
  list: (activityId: string) =>
    apiFetch<{ rsvps: RsvpWithUser[] }>(`/api/activities/${activityId}/rsvps`),
};
