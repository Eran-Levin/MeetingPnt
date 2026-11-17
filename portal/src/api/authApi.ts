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
  /** Opening the link from the email. Public — the browser may not be signed in. */
  verifyEmail: (token: string) =>
    apiFetch<{ user: User }>('/api/auth/verify-email', {
      method: 'POST',
      body: { token },
      skipAuth: true,
    }),
  resendVerification: () => apiFetch<void>('/api/auth/verification-email', { method: 'POST' }),
  me: () => apiFetch<{ user: User }>('/api/auth/me'),
};
