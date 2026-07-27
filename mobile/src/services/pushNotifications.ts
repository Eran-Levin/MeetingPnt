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

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
  await apiFetch<void>('/api/users/push-token', {
    method: 'POST',
    body: { expoPushToken, platform: Platform.OS },
  });
}
