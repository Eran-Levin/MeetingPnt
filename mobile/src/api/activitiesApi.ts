import type { Activity, CreateActivityDto } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const activitiesApi = {
  list: (groupId: string) => apiFetch<{ activities: Activity[] }>(`/api/groups/${groupId}/activities`),
  create: (groupId: string, dto: CreateActivityDto) =>
    apiFetch<{ activity: Activity }>(`/api/groups/${groupId}/activities`, {
      method: 'POST',
      body: dto,
    }),
  get: (id: string) => apiFetch<{ activity: Activity }>(`/api/activities/${id}`),
  publish: (id: string) =>
    apiFetch<{ activity: Activity }>(`/api/activities/${id}/publish`, { method: 'POST' }),
};
