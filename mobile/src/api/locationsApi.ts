import type {
  GeoPoint,
  LeaderLocationRequestResult,
  LocationSnapshot,
  LocationSnapshotWithUser,
} from '@meetingpnt/shared';
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
  /** A member asking the leader where they are. Answers immediately from the last known position
   * when it's recent enough, in which case the leader is never disturbed. */
  askLeader: (activityId: string) =>
    apiFetch<LeaderLocationRequestResult>(`/api/activities/${activityId}/location/ask-leader`, {
      method: 'POST',
    }),
  getLeaderLocation: (activityId: string) =>
    apiFetch<{ location: LocationSnapshotWithUser | null }>(
      `/api/activities/${activityId}/location/leader`,
    ),
};
