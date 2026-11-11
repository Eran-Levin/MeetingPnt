import type { Locale, NavApp, User } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const usersApi = {
  /** Returns the whole user, so the caller replaces its session user rather than patching it. */
  setLocale: (locale: Locale) =>
    apiFetch<{ user: User }>('/api/users/me/locale', { method: 'PUT', body: { locale } }),
  setNavApp: (navApp: NavApp) =>
    apiFetch<{ user: User }>('/api/users/me/nav-app', { method: 'PUT', body: { navApp } }),
  /** The private link a calendar app subscribes to. Reset replaces it, which kills the old one. */
  calendarFeed: () => apiFetch<{ url: string }>('/api/users/me/calendar-feed'),
  resetCalendarFeed: () =>
    apiFetch<{ url: string }>('/api/users/me/calendar-feed/reset', { method: 'POST' }),
};
