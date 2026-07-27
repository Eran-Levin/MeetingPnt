import type { GeoPoint, LocationSnapshot } from '@meetingpnt/shared';
import { apiFetch } from './client';

export const locationsApi = {
  submitOmw: (activityId: string, location: GeoPoint) =>
    apiFetch<{ snapshot: LocationSnapshot }>(`/api/activities/${activityId}/location/omw`, {
      method: 'POST',
      body: { location },
    }),
  submitPingResponse: (activityId: string, location: GeoPoint) =>
    apiFetch<{ snapshot: LocationSnapshot }>(`/api/activities/${activityId}/location/ping-response`, {
      method: 'POST',
      body: { location },
    }),
  requestPing: (activityId: string, userId: string) =>
    apiFetch<void>(`/api/activities/${activityId}/location/ping`, {
      method: 'POST',
      body: { userId },
    }),
};
