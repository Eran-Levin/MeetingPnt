import type { MeetingPoint } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const meetingPointsApi = {
  list: (activityId: string) =>
    apiFetch<{ meetingPoints: MeetingPoint[] }>(`/api/activities/${activityId}/meeting-points`),
};
