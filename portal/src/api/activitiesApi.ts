import type {
  Activity,
  ActivityWithGroup,
  CopyMultiDayEventDto,
  CreateActivityDto,
  CreateMultiDayEventDto,
  MoveMultiDayEventDto,
  MultiDayEvent,
  UpdateActivityDto,
  UpdateMultiDayEventDto,
} from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const activitiesApi = {
  list: (groupId: string) => apiFetch<{ activities: Activity[] }>(`/api/groups/${groupId}/activities`),
  /** Every group's events in one timeline, oldest first. */
  listMine: () => apiFetch<{ activities: ActivityWithGroup[] }>('/api/activities/mine'),
  create: (groupId: string, dto: CreateActivityDto) =>
    apiFetch<{ activity: Activity } | { activities: Activity[] }>(
      `/api/groups/${groupId}/activities`,
      { method: 'POST', body: dto },
    ),
  createMultiDay: (groupId: string, dto: CreateMultiDayEventDto) =>
    apiFetch<{ multiDayEvent: MultiDayEvent; activities: Activity[] }>(
      `/api/groups/${groupId}/multi-day-events`,
      { method: 'POST', body: dto },
    ),
  listMultiDay: (groupId: string) =>
    apiFetch<{ multiDayEvents: MultiDayEvent[] }>(`/api/groups/${groupId}/multi-day-events`),
  updateMultiDay: (id: string, dto: UpdateMultiDayEventDto) =>
    apiFetch<{ multiDayEvent: MultiDayEvent; invited: number }>(`/api/multi-day-events/${id}`, {
      method: 'PATCH',
      body: dto,
    }),
  moveMultiDay: (id: string, dto: MoveMultiDayEventDto) =>
    apiFetch<{ activities: Activity[]; invited: number }>(`/api/multi-day-events/${id}/move`, {
      method: 'POST',
      body: dto,
    }),
  copyMultiDay: (id: string, dto: CopyMultiDayEventDto) =>
    apiFetch<{ multiDayEvent: MultiDayEvent; activities: Activity[] }>(
      `/api/multi-day-events/${id}/copy`,
      { method: 'POST', body: dto },
    ),
  removeMultiDay: (id: string) =>
    apiFetch<{ invited: number }>(`/api/multi-day-events/${id}`, { method: 'DELETE' }),
  publishMultiDay: (id: string) =>
    apiFetch<{ activities: Activity[]; invited: number }>(`/api/multi-day-events/${id}/publish`, {
      method: 'POST',
    }),
  get: (id: string) => apiFetch<{ activity: Activity }>(`/api/activities/${id}`),
  update: (id: string, dto: UpdateActivityDto) =>
    apiFetch<{ activity: Activity; invited: number }>(`/api/activities/${id}`, {
      method: 'PATCH',
      body: dto,
    }),
  publish: (id: string) =>
    apiFetch<{ activity: Activity; invited: number }>(`/api/activities/${id}/publish`, { method: 'POST' }),
  start: (id: string) =>
    apiFetch<{ activity: Activity }>(`/api/activities/${id}/start`, { method: 'POST' }),
  end: (id: string) =>
    apiFetch<{ activity: Activity }>(`/api/activities/${id}/end`, { method: 'POST' }),
  publishSeries: (seriesId: string) =>
    apiFetch<{ activities: Activity[]; invited: number }>(`/api/activities/series/${seriesId}/publish`, {
      method: 'POST',
    }),
  remove: (id: string) =>
    apiFetch<{ invited: number }>(`/api/activities/${id}`, { method: 'DELETE' }),
};
