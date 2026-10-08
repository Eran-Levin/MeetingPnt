import type { Activity } from '@meetingpnt/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { activitiesApi } from '../api/activitiesApi.js';
import { apiErrorMessage, useTranslation } from '../i18n/index.js';
import { Button } from './ui/Button.js';
import { TextField } from './ui/TextField.js';

interface Props {
  activity: Activity;
  onDone: () => void;
}

function toDateInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Editing one occurrence. Series occurrences are independent rows, so this changes only the one
 * being edited — which is exactly what a leader wants when a single session shifts, or when the
 * pre-trip gathering needs confirmations but the trek days don't.
 */
export function ActivityEditor({ activity, onDone }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [allDay, setAllDay] = useState(activity.allDay);
  const [date, setDate] = useState(toDateInput(activity.startAt));
  const [endDate, setEndDate] = useState(toDateInput(activity.endAt));
  const [startTime, setStartTime] = useState(toTimeInput(activity.startAt));
  const [endTime, setEndTime] = useState(toTimeInput(activity.endAt));
  const [requiresRsvp, setRequiresRsvp] = useState(activity.requiresRsvp);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const notYetRun = activity.status === 'draft' || activity.status === 'published';
  const minDate = notYetRun ? toDateInput(new Date().toISOString()) : undefined;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const start = allDay ? new Date(`${date}T00:00:00`) : new Date(`${date}T${startTime}`);
    const end = allDay ? new Date(`${endDate || date}T23:59:59`) : new Date(`${date}T${endTime}`);

    if (end <= start) {
      setError(allDay ? t('newActivity.endDateBeforeStart') : t('newActivity.endTimeBeforeStart'));
      return;
    }

    // Only guards events that haven't run. A completed or running event can be back-dated so a
    // leader can correct the record; the backend applies the same rule.
    const notYetRun = activity.status === 'draft' || activity.status === 'published';
    if (notYetRun && start.getTime() < Date.now()) {
      setError(t('activityEditor.pastError'));
      return;
    }

    setSaving(true);
    try {
      await activitiesApi.update(activity.id, {
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        allDay,
        requiresRsvp,
      });
      queryClient.invalidateQueries({ queryKey: ['activities', activity.id] });
      queryClient.invalidateQueries({ queryKey: ['activities', activity.id, 'rsvps'] });
      queryClient.invalidateQueries({ queryKey: ['groups', activity.groupId, 'activities'] });
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, t('activityEditor.failed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3 rounded-lg bg-surface-sunken p-4">
      <label className="flex items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="h-4 w-4 rounded border-line-strong text-accent-text focus:ring-accent"
        />
        {t('activityEditor.spans')}
      </label>

      {allDay ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label={t('newActivity.startDate')} type="date" required min={minDate} value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label={t('newActivity.endDate')} type="date" required min={date || minDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField label={t('newActivity.date')} type="date" required min={minDate} value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label={t('newActivity.startTime')} type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <TextField label={t('newActivity.endTime')} type="time" required min={startTime} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      )}

      <p className="text-xs text-ink-secondary">{t('activityEditor.shiftNote')}</p>

      <label className="flex items-center gap-2 border-t border-line pt-3 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={requiresRsvp}
          onChange={(e) => setRequiresRsvp(e.target.checked)}
          className="h-4 w-4 rounded border-line-strong text-accent-text focus:ring-accent"
        />
        {t('newActivity.approve')}
      </label>
      <p className="-mt-2 text-xs text-ink-secondary">
        {requiresRsvp ? t('newActivity.approveOn') : t('activityEditor.approveOff')}
        {activity.status !== 'draft' && requiresRsvp !== activity.requiresRsvp && (
          <>
            {' '}
            <span className="text-tone-warning-fg">
              {requiresRsvp ? t('activityEditor.warnOn') : t('activityEditor.warnOff')}{' '}
              {t('activityEditor.kept')}
            </span>
          </>
        )}
      </p>

      {error && <p className="text-sm text-tone-danger-fg">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? t('common.saving') : t('activityEditor.saveChanges')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
