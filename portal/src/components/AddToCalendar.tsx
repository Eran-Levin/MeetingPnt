import type { Activity } from '@meetingpnt/shared';
import {
  activityCalendarEvent,
  buildIcsCalendar,
  googleCalendarEventUrl,
} from '@meetingpnt/shared';
import { useQuery } from '@tanstack/react-query';
import { meetingPointsApi } from '../api/meetingPointsApi.js';
import { useTranslation } from '../i18n/index.js';

const LINK_CLASSES =
  'inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken';

/**
 * Puts this one event in the leader's own calendar — the moment they've just created it is when
 * they want it there. Works on a draft too: it's their calendar and their plan.
 *
 * Both ways are built in the browser from what the page already has, so neither needs the server:
 * Google takes a link, and everything else (Apple, Outlook) takes a file. It's a copy, not a
 * subscription — rescheduling the event later doesn't move it in the calendar.
 */
export function AddToCalendar({
  activity,
  groupName,
}: {
  activity: Activity;
  groupName?: string | null;
}) {
  const { t } = useTranslation();

  // Same key as the route panel on this page, so this costs no extra request and picks up a
  // newly added first stop as the location.
  const { data } = useQuery({
    queryKey: ['activities', activity.id, 'meeting-points'],
    queryFn: () => meetingPointsApi.list(activity.id),
  });

  const event = activityCalendarEvent(activity, { groupName, start: data?.meetingPoints[0] });
  const file = `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcsCalendar([event]))}`;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-secondary">{t('addToCalendar.label')}</span>
      <a className={LINK_CLASSES} href={googleCalendarEventUrl(event)} target="_blank" rel="noreferrer">
        {t('addToCalendar.google')}
      </a>
      <a className={LINK_CLASSES} href={file} download="event.ics">
        {t('addToCalendar.file')}
      </a>
    </div>
  );
}
