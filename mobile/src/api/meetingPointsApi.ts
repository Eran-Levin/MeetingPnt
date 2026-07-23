import type { CreateMeetingPointDto, MeetingPoint } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const meetingPointsApi = {
  list: (activityId: string) =>
    apiFetch<{ meetingPoints: MeetingPoint[] }>(`/api/activities/${activityId}/meeting-points`),
  create: (activityId: string, dto: CreateMeetingPointDto) =>
    apiFetch<{ meetingPoint: MeetingPoint }>(`/api/activities/${activityId}/meeting-points`, {
      method: 'POST',
      body: dto,
    }),
};
