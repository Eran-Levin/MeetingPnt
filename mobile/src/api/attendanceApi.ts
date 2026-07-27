import type { AttendanceStatus, AttendanceWithUser } from '@meetingpnt/shared';
import { apiFetch } from './client';

export const attendanceApi = {
  list: (activityId: string) =>
    apiFetch<{ attendance: AttendanceWithUser[] }>(`/api/activities/${activityId}/attendance`),
  mark: (activityId: string, userId: string, status: AttendanceStatus) =>
    apiFetch<{ attendance: AttendanceWithUser[] }>(`/api/activities/${activityId}/attendance`, {
      method: 'PUT',
      body: { entries: [{ userId, status }] },
    }),
};
