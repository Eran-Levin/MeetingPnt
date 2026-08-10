import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { locationsApi } from '../api/locationsApi';
import { getCurrentLocationSnapshot } from './location';

const LOCATION_PING_CATEGORY = 'location_ping';
/** The mirror of the above: a member asking the leader. Same action, same response — the only
 * difference is who is being asked, so both categories share one handler. */
const LEADER_LOCATION_REQUEST_CATEGORY = 'leader_location_request';
const BACKGROUND_NOTIFICATION_TASK = 'background-notification-task';

const SHARE_LOCATION_ACTION = [
  {
    identifier: 'share_location',
    buttonTitle: 'Share Location',
    options: { opensAppToForeground: true },
  },
];

export async function setupNotificationCategories() {
  await Notifications.setNotificationCategoryAsync(LOCATION_PING_CATEGORY, SHARE_LOCATION_ACTION);
  await Notifications.setNotificationCategoryAsync(
    LEADER_LOCATION_REQUEST_CATEGORY,
    SHARE_LOCATION_ACTION,
  );
}

interface PingNotificationData {
  type?: string;
  activityId?: string;
}

/** Both notification types mean the same thing to whoever receives one: report where you are. */
function isLocationRequest(data: PingNotificationData | undefined): data is PingNotificationData &
  { activityId: string } {
  return (
    !!data?.activityId &&
    (data.type === 'location_ping' || data.type === 'leader_location_request')
  );
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
    if (isLocationRequest(data)) {
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
  if (isLocationRequest(payload)) {
    await respondToPing(payload.activityId);
  }
});

export async function registerBackgroundNotificationTask() {
  await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
}
