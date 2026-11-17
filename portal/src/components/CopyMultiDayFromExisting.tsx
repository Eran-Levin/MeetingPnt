import type { Activity, GroupWithRole, MultiDayEvent } from '@meetingpnt/shared';
import { useEffect, useState } from 'react';
import { activitiesApi } from '../api/activitiesApi.js';
import { groupsApi } from '../api/groupsApi.js';
import { apiErrorMessage, useLocale, useTranslation } from '../i18n/index.js';
import { localDate } from '../lib/days.js';
import { Button } from './ui/Button.js';
import { Card } from './ui/Card.js';
import { Select } from './ui/Select.js';
import { TextField } from './ui/TextField.js';

/** What the multi-day create page needs to copy an event into the group it is in. */
export interface MultiDayCopy {
  sourceId: string;
  title: string;
  description: string;
  /** How many days come across, so the end date can follow the start. */
  dayCount: number;
  /** The source's first day, as the browser sees it — the copy moves by the distance to the new date. */
  sourceStart: string;
  /** The date the leader picked for the copy's first day. */
  newStart: string;
}

interface Props {
  onApply: (copy: MultiDayCopy) => void;
}

/**
 * Start a multi-day event from one the leader already runs — in this group or any other. Shows the
 * events themselves, not their days: a day on its own is a fragment of a trip. Collapsed until
 * wanted, like the single-activity picker.
 */
export function CopyMultiDayFromExisting({ onApply }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<GroupWithRole[]>([]);
  const [groupId, setGroupId] = useState('');
  const [events, setEvents] = useState<{ event: MultiDayEvent; days: Activity[] }[] | null>(null);
  const [eventId, setEventId] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Only groups they lead: a member can't plan from someone else's draft.
  useEffect(() => {
    if (!open || groups.length > 0) return;
    groupsApi
      .list()
      .then(({ groups }) => setGroups(groups.filter((g) => g.isLeader)))
      .catch((err) => setError(apiErrorMessage(err, t('multiDay.copyFrom.failed'))));
  }, [open, groups.length, t]);

  useEffect(() => {
    setEventId('');
    setEvents(null);
    if (!groupId) return;
    let stale = false;
    Promise.all([activitiesApi.listMultiDay(groupId), activitiesApi.list(groupId)])
      .then(([{ multiDayEvents }, { activities }]) => {
        if (stale) return;
        const rows = multiDayEvents
          .map((event) => ({
            event,
            days: activities
              .filter((a) => a.multiDayEventId === event.id && a.status !== 'cancelled')
              .sort((a, b) => a.startAt.localeCompare(b.startAt)),
          }))
          .filter((row) => row.days.length > 0)
          // Newest first: the one worth repeating is usually the last one run.
          .sort((a, b) => b.days[0]!.startAt.localeCompare(a.days[0]!.startAt));
        setEvents(rows);
      })
      .catch((err) => !stale && setError(apiErrorMessage(err, t('multiDay.copyFrom.failed'))));
    return () => {
      stale = true;
    };
  }, [groupId, t]);

  function apply() {
    const row = events?.find((r) => r.event.id === eventId);
    if (!row || !date) return;
    onApply({
      sourceId: row.event.id,
      title: row.event.title,
      description: row.event.description ?? '',
      dayCount: row.days.length,
      sourceStart: localDate(row.days[0]!.startAt),
      newStart: date,
    });
    setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          {t('activityForm.copy.open')}
        </Button>
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-sm text-ink-secondary">{t('multiDay.copyFrom.hint')}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label={t('activityForm.copy.group')}
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="">{t('activityForm.copy.pickGroup')}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>

        <Select
          label={t('multiDay.copyFrom.event')}
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          disabled={!events || events.length === 0}
        >
          <option value="">
            {groupId && !events ? t('activityForm.copy.loading') : t('multiDay.copyFrom.pickEvent')}
          </option>
          {(events ?? []).map(({ event, days }) => (
            <option key={event.id} value={event.id}>
              {event.title} · {new Date(days[0]!.startAt).toLocaleDateString(locale)} ·{' '}
              {t('groupDetail.multiDayDays', { count: days.length })}
            </option>
          ))}
        </Select>
      </div>

      {events?.length === 0 && (
        <p className="text-sm text-ink-secondary">{t('multiDay.copyFrom.noEvents')}</p>
      )}

      <TextField
        label={t('multiDay.copyFrom.newStart')}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {error && (
        <p className="rounded-md bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger-fg">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={apply} disabled={!eventId || !date}>
          {t('activityForm.copy.apply')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t('activityForm.copy.cancel')}
        </Button>
      </div>
    </Card>
  );
}
