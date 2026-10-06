import type { Locale, User } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const usersApi = {
  /** Returns the whole user, so the caller replaces its session user rather than patching it. */
  setLocale: (locale: Locale) =>
    apiFetch<{ user: User }>('/api/users/me/locale', { method: 'PUT', body: { locale } }),
};
