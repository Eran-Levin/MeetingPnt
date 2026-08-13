import type { Activity } from '@meetingpnt/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { activitiesApi } from '../api/activitiesApi.js';
import { ApiError } from '../api/client.js';
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
      setError(allDay ? 'The end date must not be before the start date.' : 'The end time must be after the start time.');
      return;
    }

    // Only guards events that haven't run. A completed or running event can be back-dated so a
    // leader can correct the record; the backend applies the same rule.
    const notYetRun = activity.status === 'draft' || activity.status === 'published';
    if (notYetRun && start.getTime() < Date.now()) {
      setError("You can't schedule an event in the past.");
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
      setError(err instanceof ApiError ? err.message : 'Failed to save the event');
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
        Spans whole days (multi-day trip)
      </label>

      {allDay ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Start date" type="date" required min={minDate} value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label="End date" type="date" required min={date || minDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField label="Date" type="date" required min={minDate} value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label="Start time" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <TextField label="End time" type="time" required min={startTime} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      )}

      <p className="text-xs text-ink-secondary">Meeting point times shift with the event.</p>

      <label className="flex items-center gap-2 border-t border-line pt-3 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={requiresRsvp}
          onChange={(e) => setRequiresRsvp(e.target.checked)}
          className="h-4 w-4 rounded border-line-strong text-accent-text focus:ring-accent"
        />
        Approve attendance
      </label>
      <p className="-mt-2 text-xs text-ink-secondary">
        {requiresRsvp
          ? 'Members are asked to confirm they’re coming.'
          : 'Members count as coming without replying — they can still decline.'}
        {activity.status !== 'draft' && requiresRsvp !== activity.requiresRsvp && (
          <>
            {' '}
            <span className="text-tone-warning-fg">
              {requiresRsvp
                ? 'Anyone who never actually replied will go back to awaiting a reply.'
                : 'Anyone who never replied will be counted as coming.'}{' '}
              Replies already given are kept either way.
            </span>
          </>
        )}
      </p>

      {error && <p className="text-sm text-tone-danger-fg">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
