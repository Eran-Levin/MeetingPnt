import type { Locale, NavApp, User } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const usersApi = {
  /** Returns the whole user, so the caller replaces its session user rather than patching it. */
  setLocale: (locale: Locale) =>
    apiFetch<{ user: User }>('/api/users/me/locale', { method: 'PUT', body: { locale } }),
  setNavApp: (navApp: NavApp) =>
    apiFetch<{ user: User }>('/api/users/me/nav-app', { method: 'PUT', body: { navApp } }),
};
