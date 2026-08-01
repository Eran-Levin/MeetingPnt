import type { Activity, ActivityWithGroup, CreateActivityDto } from '@meetingpnt/shared';
import { apiFetch } from './client';

export const activitiesApi = {
  list: (groupId: string) => apiFetch<{ activities: Activity[] }>(`/api/groups/${groupId}/activities`),
  create: (groupId: string, dto: CreateActivityDto) =>
    apiFetch<{ activity: Activity } | { activities: Activity[] }>(
      `/api/groups/${groupId}/activities`,
      { method: 'POST', body: dto },
    ),
  get: (id: string) => apiFetch<{ activity: Activity }>(`/api/activities/${id}`),
  /** Timeline across every group the user belongs to, oldest first. */
  listMine: () => apiFetch<{ activities: ActivityWithGroup[] }>('/api/activities/mine'),
  publish: (id: string) =>
    apiFetch<{ activity: Activity }>(`/api/activities/${id}/publish`, { method: 'POST' }),
  start: (id: string) =>
    apiFetch<{ activity: Activity }>(`/api/activities/${id}/start`, { method: 'POST' }),
  end: (id: string) =>
    apiFetch<{ activity: Activity }>(`/api/activities/${id}/end`, { method: 'POST' }),
  publishSeries: (seriesId: string) =>
    apiFetch<{ activities: Activity[] }>(`/api/activities/series/${seriesId}/publish`, {
      method: 'POST',
    }),
};
