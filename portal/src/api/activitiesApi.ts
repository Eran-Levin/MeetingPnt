import type { Activity, CreateActivityDto, UpdateActivityDto } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const activitiesApi = {
  list: (groupId: string) => apiFetch<{ activities: Activity[] }>(`/api/groups/${groupId}/activities`),
  create: (groupId: string, dto: CreateActivityDto) =>
    apiFetch<{ activity: Activity }>(`/api/groups/${groupId}/activities`, {
      method: 'POST',
      body: dto,
    }),
  get: (id: string) => apiFetch<{ activity: Activity }>(`/api/activities/${id}`),
  update: (id: string, dto: UpdateActivityDto) =>
    apiFetch<{ activity: Activity }>(`/api/activities/${id}`, { method: 'PATCH', body: dto }),
  publish: (id: string) =>
    apiFetch<{ activity: Activity }>(`/api/activities/${id}/publish`, { method: 'POST' }),
  remove: (id: string) => apiFetch<void>(`/api/activities/${id}`, { method: 'DELETE' }),
};
