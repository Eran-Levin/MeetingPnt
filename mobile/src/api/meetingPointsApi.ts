import type {
  CreateMeetingPointDto,
  MeetingPoint,
  UpdateMeetingPointDto,
} from '@meetingpnt/shared';
import { apiFetch } from './client';

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
  /** Moves the group on: reaches the next planned stop, or creates one past the end of the plan. */
  advance: (activityId: string, dto: CreateMeetingPointDto) =>
    apiFetch<{ meetingPoint: MeetingPoint }>(
      `/api/activities/${activityId}/meeting-points/advance`,
      { method: 'POST', body: dto },
    ),
};
