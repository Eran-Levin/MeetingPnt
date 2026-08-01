import type {
  CreateMeetingPointDto,
  MeetingPoint,
  UpdateMeetingPointDto,
} from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const meetingPointsApi = {
  list: (activityId: string) =>
    apiFetch<{ meetingPoints: MeetingPoint[] }>(`/api/activities/${activityId}/meeting-points`),
  create: (activityId: string, dto: CreateMeetingPointDto) =>
    apiFetch<{ meetingPoint: MeetingPoint }>(`/api/activities/${activityId}/meeting-points`, {
      method: 'POST',
      body: dto,
    }),
  update: (meetingPointId: string, dto: UpdateMeetingPointDto) =>
    apiFetch<{ meetingPoint: MeetingPoint }>(`/api/meeting-points/${meetingPointId}`, {
      method: 'PATCH',
      body: dto,
    }),
};
