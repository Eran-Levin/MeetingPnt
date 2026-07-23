import { Expo } from 'expo-server-sdk';

const expo = new Expo();

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: 'default' | 'high';
  categoryId?: string;
}

export async function sendPushNotifications(messages: PushMessage[]) {
  const validMessages = messages.filter((m) => Expo.isExpoPushToken(m.to));
  if (validMessages.length === 0) return;

  const chunks = expo.chunkPushNotifications(
    validMessages.map((m) => ({
      to: m.to,
      sound: 'default' as const,
      title: m.title,
      body: m.body,
      data: m.data,
      priority: m.priority ?? 'default',
      categoryId: m.categoryId,
    })),
  );

  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error('[push] failed to send chunk', err);
    }
  }
}
