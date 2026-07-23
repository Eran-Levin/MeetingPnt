import type {
  CreateGroupDto,
  Group,
  GroupMemberWithUser,
  GroupWithRole,
} from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const groupsApi = {
  list: () => apiFetch<{ groups: GroupWithRole[] }>('/api/groups'),
  create: (dto: CreateGroupDto) =>
    apiFetch<{ group: Group }>('/api/groups', { method: 'POST', body: dto }),
  get: (id: string) => apiFetch<{ group: Group }>(`/api/groups/${id}`),
  listMembers: (id: string) =>
    apiFetch<{ members: GroupMemberWithUser[] }>(`/api/groups/${id}/members`),
};
