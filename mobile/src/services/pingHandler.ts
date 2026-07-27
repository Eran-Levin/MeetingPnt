import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { locationsApi } from '../api/locationsApi';
import { getCurrentLocationSnapshot } from './location';

const LOCATION_PING_CATEGORY = 'location_ping';
const BACKGROUND_NOTIFICATION_TASK = 'background-notification-task';

export async function setupNotificationCategories() {
  await Notifications.setNotificationCategoryAsync(LOCATION_PING_CATEGORY, [
    {
      identifier: 'share_location',
      buttonTitle: 'Share Location',
      options: { opensAppToForeground: true },
    },
  ]);
}

interface PingNotificationData {
  type?: string;
  activityId?: string;
}

async function respondToPing(activityId: string) {
  const location = await getCurrentLocationSnapshot();
  if (!location) return;
  await locationsApi.submitPingResponse(activityId, location);
}

/** Reliable path: user taps the notification or its "Share Location" action while foregrounded/backgrounded. */
export function registerNotificationResponseHandler() {
  return Notifications.addNotificationResponseReceivedListener(async (response) => {
    const data = response.notification.request.content.data as PingNotificationData;
    if (data?.type === 'location_ping' && data.activityId) {
      await respondToPing(data.activityId);
    }
  });
}

// Best-effort silent path: attempts to auto-respond when a data push arrives while the
// app is backgrounded. Must be defined at module scope. Reliable on Android; on iOS this
// only runs within the OS's short background execution budget (~30s) and may not fire —
// that's a platform limit, not a bug, so the reliable notification-action path above is
// the one users can depend on.
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) return;
  const payload = (data as { notification?: { request?: { content?: { data?: PingNotificationData } } } })
    ?.notification?.request?.content?.data;
  if (payload?.type === 'location_ping' && payload.activityId) {
    await respondToPing(payload.activityId);
  }
});

export async function registerBackgroundNotificationTask() {
  await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
}
