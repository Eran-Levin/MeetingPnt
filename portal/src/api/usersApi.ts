import type { Locale, NavApp, User } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const usersApi = {
  /** Returns the whole user, so the caller replaces its session user rather than patching it. */
  setLocale: (locale: Locale) =>
    apiFetch<{ user: User }>('/api/users/me/locale', { method: 'PUT', body: { locale } }),
  /** The leader's default time zone, inherited by groups and events that don't set their own. */
  setTimeZone: (timeZone: string) =>
    apiFetch<{ user: User }>('/api/users/me/time-zone', { method: 'PUT', body: { timeZone } }),
  setNavApp: (navApp: NavApp) =>
    apiFetch<{ user: User }>('/api/users/me/nav-app', { method: 'PUT', body: { navApp } }),
};
