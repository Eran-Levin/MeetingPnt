import type {
  CreateGroupDto,
  Group,
  GroupMemberWithUser,
  GroupWithRole,
  UpdateGroupDto,
} from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const groupsApi = {
  list: () => apiFetch<{ groups: GroupWithRole[] }>('/api/groups'),
  create: (dto: CreateGroupDto) =>
    apiFetch<{ group: Group }>('/api/groups', { method: 'POST', body: dto }),
  get: (id: string) => apiFetch<{ group: Group }>(`/api/groups/${id}`),
  update: (id: string, dto: UpdateGroupDto) =>
    apiFetch<{ group: Group }>(`/api/groups/${id}`, { method: 'PATCH', body: dto }),
  remove: (id: string) => apiFetch<void>(`/api/groups/${id}`, { method: 'DELETE' }),
  listMembers: (id: string) =>
    apiFetch<{ members: GroupMemberWithUser[] }>(`/api/groups/${id}/members`),
  removeMember: (id: string, userId: string) =>
    apiFetch<void>(`/api/groups/${id}/members/${userId}`, { method: 'DELETE' }),
};
