import type { Role, User } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const adminApi = {
  listUsers: (params: { search?: string; role?: Role } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    const qs = query.toString();
    return apiFetch<{ users: User[] }>(`/api/admin/users${qs ? `?${qs}` : ''}`);
  },
  elevateRole: (userId: string, role: Role) =>
    apiFetch<{ user: User }>(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: { role },
    }),
};
