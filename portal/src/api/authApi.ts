import type { AuthResponse, LoginDto, RegisterDto, User } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const authApi = {
  login: (dto: LoginDto) =>
    apiFetch<AuthResponse>('/api/auth/login', { method: 'POST', body: dto, skipAuth: true }),
  register: (dto: RegisterDto) =>
    apiFetch<AuthResponse>('/api/auth/register', { method: 'POST', body: dto, skipAuth: true }),
  refresh: () =>
    apiFetch<AuthResponse>('/api/auth/refresh', { method: 'POST', skipAuth: true }),
  logout: () => apiFetch<void>('/api/auth/logout', { method: 'POST', skipAuth: true }),
  me: () => apiFetch<{ user: User }>('/api/auth/me'),
};
