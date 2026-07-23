import type { LocationSnapshotWithUser } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const locationsApi = {
  latest: (activityId: string) =>
    apiFetch<{ locations: LocationSnapshotWithUser[] }>(`/api/activities/${activityId}/location/latest`),
  requestPing: (activityId: string, userId: string) =>
    apiFetch<void>(`/api/activities/${activityId}/location/ping`, {
      method: 'POST',
      body: { userId },
    }),
};
