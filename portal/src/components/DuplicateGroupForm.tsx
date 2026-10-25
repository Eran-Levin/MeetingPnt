import type { Activity, Group } from '@meetingpnt/shared';
import { isolate } from '@meetingpnt/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupsApi } from '../api/groupsApi.js';
import { apiErrorMessage, useLocale, useTranslation } from '../i18n/index.js';
import { Button } from './ui/Button.js';
import { TextField } from './ui/TextField.js';

interface Props {
  group: Group;
  activities: Activity[];
  onDone: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Whole calendar days between two `YYYY-MM-DD` dates, immune to daylight-saving changes. */
function daysBetween(from: string, to: string): number {
  const [fy = 0, fm = 1, fd = 1] = from.split('-').map(Number);
  const [ty = 0, tm = 1, td = 1] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/**
 * Starts a new group from this one. The two choices are independent: the same people carrying on
 * with new events, or the same trip with new people. The server does the copying; all this
 * decides is how far the events move, from where the first one falls today to where it should.
 */
export function DuplicateGroupForm({ group, activities, onDone }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Cancelled events don't come across, so they can't be what "the first event" means.
  const copyable = activities.filter((a) => a.status !== 'cancelled');
  const firstStart = copyable.length
    ? new Date(Math.min(...copyable.map((a) => new Date(a.startAt).getTime())))
    : null;
  const firstDate = firstStart ? toDateInput(firstStart) : '';

  const [name, setName] = useState(`${group.name} ${t('groupPage.duplicate.nameSuffix')}`);
  const [description, setDescription] = useState(group.description ?? '');
  const [copyRoster, setCopyRoster] = useState(true);
  const [copyEvents, setCopyEvents] = useState(copyable.length > 0);
  const [newFirstDate, setNewFirstDate] = useState(firstDate);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      const { group: created } = await groupsApi.duplicate(group.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        copyRoster,
        copyEvents,
        shiftDays: copyEvents && firstDate && newFirstDate ? daysBetween(firstDate, newFirstDate) : 0,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      // Straight to the new group: everything about it is editable from there.
      navigate(`/groups/${created.id}`);
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, t('groupPage.duplicate.failed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 rounded-lg bg-surface-sunken p-4">
      <p className="text-sm font-medium text-ink">
        {t('groupPage.duplicate.title', { name: isolate(group.name) })}
      </p>
      <p className="-mt-2 text-xs text-ink-secondary">{t('groupPage.duplicate.hint')}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label={t('groups.groupName')}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label={t('newActivity.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 border-t border-line pt-3 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={copyRoster}
          onChange={(e) => setCopyRoster(e.target.checked)}
          className="h-4 w-4 rounded border-line-strong text-accent-text focus:ring-accent"
        />
        {t('groupPage.duplicate.copyRoster')}
      </label>
      <p className="-mt-2 text-xs text-ink-secondary">{t('groupPage.duplicate.copyRosterHint')}</p>

      <label className="flex items-center gap-2 border-t border-line pt-3 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={copyEvents}
          disabled={copyable.length === 0}
          onChange={(e) => setCopyEvents(e.target.checked)}
          className="h-4 w-4 rounded border-line-strong text-accent-text focus:ring-accent"
        />
        {t('groupPage.duplicate.copyEvents')}
      </label>
      <p className="-mt-2 text-xs text-ink-secondary">
        {copyable.length === 0
          ? t('groupPage.duplicate.noEvents')
          : t('groupPage.duplicate.copyEventsHint')}
      </p>

      {copyEvents && firstStart && (
        <div className="max-w-xs">
          <TextField
            label={t('groupPage.duplicate.firstEventOn')}
            type="date"
            required
            value={newFirstDate}
            onChange={(e) => setNewFirstDate(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-secondary">
            {t('groupPage.duplicate.firstEventHint', {
              when: firstStart.toLocaleDateString(locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
            })}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-tone-danger-fg">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? t('groupPage.duplicate.creating') : t('groupPage.duplicate.submit')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
