import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiFetch } from '../api/client';

export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) return; // simulators can't receive real push tokens

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  // A standalone build has no dev-server URL to infer the project from, so the EAS project id has
  // to be passed explicitly. It lands in app.json when `eas init` links the project; without it,
  // push is simply unavailable rather than a startup crash.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    console.warn('[push] no EAS projectId in app config — skipping push registration');
    return;
  }

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  await apiFetch<void>('/api/users/push-token', {
    method: 'POST',
    body: { expoPushToken, platform: Platform.OS },
  });
}
