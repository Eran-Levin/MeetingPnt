import type { AuthResponse } from '@meetingpnt/shared';
import { useAuthStore } from '../store/authStore.js';
import { secureStore } from './secureStore.js';

export async function establishSession(data: AuthResponse) {
  useAuthStore.getState().setSession(data.user, data.accessToken);
  if (data.refreshToken) {
    await secureStore.setRefreshToken(data.refreshToken);
  }
}

export async function endSession() {
  useAuthStore.getState().clearSession();
  await secureStore.clearRefreshToken();
}
