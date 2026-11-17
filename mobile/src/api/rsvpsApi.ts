import type { Attendee, Rsvp, RsvpUpdateDto, RsvpWithUser } from '@meetingpnt/shared';
import { apiFetch } from './client';

export const rsvpsApi = {
  upsert: (activityId: string, dto: RsvpUpdateDto) =>
    apiFetch<{ rsvp: Rsvp }>(`/api/activities/${activityId}/rsvp`, { method: 'POST', body: dto }),
  /** One answer for every day of a multi-day event that hasn't started. */
  replyToMultiDay: (multiDayEventId: string, status: 'approved' | 'declined') =>
    apiFetch<{ rsvps: Rsvp[] }>(`/api/multi-day-events/${multiDayEventId}/rsvp`, {
      method: 'POST',
      body: { status },
    }),
  getMine: (activityId: string) =>
    apiFetch<{ rsvp: Rsvp | null }>(`/api/activities/${activityId}/rsvp/me`),
  /** Who's confirmed as coming — visible to any participant, names only. */
  attendees: (activityId: string) =>
    apiFetch<{ attendees: Attendee[] }>(`/api/activities/${activityId}/attendees`),
  list: (activityId: string) =>
    apiFetch<{ rsvps: RsvpWithUser[] }>(`/api/activities/${activityId}/rsvps`),
  /** Leader answering for a member — "they rang to say they can't make it". */
  setForUser: (activityId: string, userId: string, dto: RsvpUpdateDto) =>
    apiFetch<{ rsvp: Rsvp }>(`/api/activities/${activityId}/rsvps/${userId}`, {
      method: 'PUT',
      body: dto,
    }),
};
