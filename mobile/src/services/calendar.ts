import {
  activityCalendarEvent,
  googleCalendarEventUrl,
  type CalendarEvent,
} from '@meetingpnt/shared';
import { Linking } from 'react-native';
import { activitiesApi } from '../api/activitiesApi';
import { groupsApi } from '../api/groupsApi';
import { meetingPointsApi } from '../api/meetingPointsApi';

/**
 * Hands one event to the phone's calendar, filled in and waiting for a Save.
 *
 * It goes through Google Calendar's "new event" link rather than writing to the calendar directly:
 * that needs no calendar permission and no native module (so it ships without a new build), and
 * the person still chooses which of their calendars it lands in.
 */
export function openInCalendar(event: CalendarEvent): Promise<void> {
  return Linking.openURL(googleCalendarEventUrl(event));
}

/**
 * The same, starting from nothing but an id — which is all a notification carries. The group's
 * name is a nicety and is allowed to fail: a visitor is invited to the event without being in
 * the group, so they can't read it.
 */
export async function addActivityToCalendar(activityId: string): Promise<void> {
  const [{ activity }, { meetingPoints }] = await Promise.all([
    activitiesApi.get(activityId),
    meetingPointsApi.list(activityId),
  ]);
  const groupName = await groupsApi
    .get(activity.groupId)
    .then((res) => res.group.name)
    .catch(() => null);
  await openInCalendar(activityCalendarEvent(activity, { groupName, start: meetingPoints[0] }));
}
