import type { User } from '@meetingpnt/shared';
import { apiFetch } from './client';

export const usersApi = {
  /** Returns the whole user, so the caller replaces its session user rather than patching it. */
  setAvatar: (image: { uri: string; name: string; type: string }) => {
    const formData = new FormData();
    // React Native's fetch/FormData accepts this {uri,name,type} shape for file parts.
    formData.append('image', image as unknown as Blob);
    return apiFetch<{ user: User }>('/api/users/me/avatar', { method: 'PUT', formData });
  },
  removeAvatar: () => apiFetch<{ user: User }>('/api/users/me/avatar', { method: 'DELETE' }),
};
