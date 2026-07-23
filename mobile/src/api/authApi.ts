import type { AuthResponse, LoginDto, RegisterDto, User } from '@meetingpnt/shared';
import { apiFetch } from './client.js';

export const authApi = {
  login: (dto: LoginDto) =>
    apiFetch<AuthResponse>('/api/auth/login', { method: 'POST', body: dto, skipAuth: true }),
  register: (dto: RegisterDto) =>
    apiFetch<AuthResponse>('/api/auth/register', { method: 'POST', body: dto, skipAuth: true }),
  refresh: (refreshToken: string) =>
    apiFetch<AuthResponse>('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      skipAuth: true,
    }),
  logout: (refreshToken: string) =>
    apiFetch<void>('/api/auth/logout', { method: 'POST', body: { refreshToken }, skipAuth: true }),
  me: () => apiFetch<{ user: User }>('/api/auth/me'),
};
