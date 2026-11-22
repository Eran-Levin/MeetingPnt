import type { Activity, TransportMode } from '@meetingpnt/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { activitiesApi } from '../api/activitiesApi.js';
import { apiErrorMessage, useTranslation } from '../i18n/index.js';
import { useInheritedZone } from '../lib/useInheritedZone.js';
import { dateInput, inputToInstant, timeInput } from '../lib/zonedInput.js';
import { TimeZoneField } from './TimeZoneField.js';
import { Button } from './ui/Button.js';
import { Select } from './ui/Select.js';
import { TextArea, TextField } from './ui/TextField.js';
import { useToast } from './ui/Toast.js';

const TRANSPORT_MODES: TransportMode[] = ['driving', 'walking', 'bicycling', 'transit'];

interface Props {
  activity: Activity;
  onDone: () => void;
}

/**
 * Editing one occurrence. Series occurrences are independent rows, so this changes only the one
 * being edited — which is exactly what a leader wants when a single session shifts, or when the
 * pre-trip gathering needs confirmations but the trek days don't.
 */
export function ActivityEditor({ activity, onDone }: Props) {
  const { t } = useTranslation();
  const showToast = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description ?? '');
  const [transportMode, setTransportMode] = useState<TransportMode>(activity.transportMode);
  const [allDay, setAllDay] = useState(activity.allDay);
  // The inputs show the event's clock, not the browser's: a tour in Denver edited from Tel Aviv
  // still reads 08:00.
  const [zoneOverride, setZoneOverride] = useState<string | null>(activity.timeZone);
  const inheritedZone = useInheritedZone(activity.groupId);
  const zone = zoneOverride ?? (activity.timeZone === null ? activity.effectiveTimeZone : inheritedZone);
  const [date, setDate] = useState(dateInput(activity.startAt, activity.effectiveTimeZone));
  const [endDate, setEndDate] = useState(dateInput(activity.endAt, activity.effectiveTimeZone));
  const [startTime, setStartTime] = useState(timeInput(activity.startAt, activity.effectiveTimeZone));
  const [endTime, setEndTime] = useState(timeInput(activity.endAt, activity.effectiveTimeZone));
  const [requiresRsvp, setRequiresRsvp] = useState(activity.requiresRsvp);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const notYetRun = activity.status === 'draft' || activity.status === 'published';
  const minDate = notYetRun ? dateInput(new Date().toISOString(), zone) : undefined;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const start = allDay
      ? inputToInstant(date, '00:00:00', zone)
      : inputToInstant(date, startTime, zone);
    const end = allDay
      ? inputToInstant(endDate || date, '23:59:59', zone)
      : inputToInstant(date, endTime, zone);

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
      const { invited } = await activitiesApi.update(activity.id, {
        title: title.trim(),
        description,
        transportMode,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        allDay,
        timeZone: zoneOverride,
        requiresRsvp,
      });
      queryClient.invalidateQueries({ queryKey: ['activities', activity.id] });
      queryClient.invalidateQueries({ queryKey: ['activities', activity.id, 'rsvps'] });
      queryClient.invalidateQueries({ queryKey: ['groups', activity.groupId, 'activities'] });
      // Saving closes the form, which says "saved"; that calendars are being updated is the part
      // nobody could otherwise see.
      showToast(
        invited > 0 ? t('publishToast.updated', { count: invited }) : t('publishToast.saved'),
      );
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, t('activityEditor.failed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3 rounded-lg bg-surface-sunken p-4">
      <TextField
        label={t('newActivity.fieldTitle')}
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TextArea
        label={t('activityForm.description')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />
      <Select
        label={t('newActivity.transport')}
        value={transportMode}
        onChange={(e) => setTransportMode(e.target.value as TransportMode)}
      >
        {TRANSPORT_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {t(`newActivity.${mode}`)}
          </option>
        ))}
      </Select>

      <label className="flex items-center gap-2 border-t border-line pt-3 text-sm font-medium text-ink">
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

      <TimeZoneField
        label={t('timeZone.label')}
        value={zoneOverride}
        inheritedZone={inheritedZone}
        onChange={setZoneOverride}
        hint={t('timeZone.eventHint')}
      />

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
