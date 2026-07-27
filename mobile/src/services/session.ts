import type { AuthResponse } from '@meetingpnt/shared';
import { registerForPushNotifications } from './pushNotifications';
import { useAuthStore } from '../store/authStore';
import { secureStore } from './secureStore';

export async function establishSession(data: AuthResponse) {
  useAuthStore.getState().setSession(data.user, data.accessToken);
  if (data.refreshToken) {
    await secureStore.setRefreshToken(data.refreshToken);
  }
  registerForPushNotifications().catch((err) =>
    console.warn('[push] registration failed', err),
  );
}

export async function endSession() {
  useAuthStore.getState().clearSession();
  await secureStore.clearRefreshToken();
}
