import type {
  ActivityParticipation,
  AttendanceStatus,
  AttendanceWithUser,
  RollCallEntry,
} from '@meetingpnt/shared';
import { apiFetch } from './client';

export const attendanceApi = {
  /** Who to expect at this meeting point, with their RSVP and whether they've been marked. */
  rollCall: (meetingPointId: string) =>
    apiFetch<{ entries: RollCallEntry[] }>(
      `/api/meeting-points/${meetingPointId}/attendance/roll-call`,
    ),
  /** All roll calls for an activity, keyed by meeting point id. */
  listForActivity: (activityId: string) =>
    apiFetch<{ attendance: Record<string, AttendanceWithUser[]> }>(
      `/api/activities/${activityId}/attendance`,
    ),
  /** Derived across meeting points: attended if present at any of them. */
  participation: (activityId: string) =>
    apiFetch<{ participation: ActivityParticipation[] }>(
      `/api/activities/${activityId}/participation`,
    ),
  mark: (meetingPointId: string, userId: string, status: AttendanceStatus) =>
    apiFetch<{ attendance: AttendanceWithUser[] }>(
      `/api/meeting-points/${meetingPointId}/attendance`,
      { method: 'PUT', body: { entries: [{ userId, status }] } },
    ),
};
