import type { Activity, GroupWithRole } from '@meetingpnt/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { activitiesApi } from '../api/activitiesApi.js';
import { groupsApi } from '../api/groupsApi.js';
import { apiErrorMessage, useLocale, useTranslation } from '../i18n/index.js';
import { Button } from './ui/Button.js';
import { Select } from './ui/Select.js';
import { TextArea, TextField } from './ui/TextField.js';

interface Props {
  /** Groups this leader runs — what a new group can start from. */
  groups: GroupWithRole[];
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
 * Creating a group — from nothing, or from one the leader already runs. Starting from one is two
 * independent choices: the roster (the same people carrying on) and the events (the same trip run
 * again). The server does the copying; all this decides is how far the events move, from where
 * the first one falls today to where it should.
 */
export function NewGroupForm({ groups, onDone }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [copyRoster, setCopyRoster] = useState(true);
  const [copyEvents, setCopyEvents] = useState(true);
  const [newFirstDate, setNewFirstDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const source = groups.find((g) => g.id === sourceId);

  function pickSource(id: string) {
    setSourceId(id);
    const picked = groups.find((g) => g.id === id);
    if (picked) {
      setName(`${picked.name} ${t('groupsPage.from.nameSuffix')}`);
      setDescription(picked.description ?? '');
    }
  }

  // The source's events decide whether there is anything to copy and where "the first one" falls.
  useEffect(() => {
    setActivities(null);
    setNewFirstDate('');
    if (!sourceId) return;
    let stale = false;
    activitiesApi
      .list(sourceId)
      .then(({ activities }) => {
        if (stale) return;
        setActivities(activities);
        const first = earliest(activities);
        setNewFirstDate(first ? toDateInput(first) : '');
        if (!first) setCopyEvents(false);
      })
      .catch((err) => !stale && setError(apiErrorMessage(err, t('groupsPage.from.failed'))));
    return () => {
      stale = true;
    };
  }, [sourceId, t]);

  // Cancelled events don't come across, so they can't be what "the first event" means.
  const copyable = (activities ?? []).filter((a) => a.status !== 'cancelled');
  const firstStart = earliest(copyable);
  const firstDate = firstStart ? toDateInput(firstStart) : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      if (source) {
        const { group } = await groupsApi.duplicate(source.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          copyRoster,
          copyEvents,
          shiftDays:
            copyEvents && firstDate && newFirstDate ? daysBetween(firstDate, newFirstDate) : 0,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        queryClient.invalidateQueries({ queryKey: ['groups'] });
        // Straight to the new group: everything about it is editable from there.
        navigate(`/groups/${group.id}`);
      } else {
        await groupsApi.create({ name: name.trim(), description: description.trim() || undefined });
        queryClient.invalidateQueries({ queryKey: ['groups'] });
      }
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, t('groupsPage.from.failed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {groups.length > 0 && (
        <Select
          label={t('groupsPage.from.pick')}
          value={sourceId}
          onChange={(e) => pickSource(e.target.value)}
          className="max-w-sm"
        >
          <option value="">{t('groupsPage.from.none')}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      )}

      <TextField
        label={t('groups.groupName')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        required
      />
      <TextArea
        label={t('newActivity.description')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />

      {source && (
        <>
          <p className="text-xs text-ink-secondary">{t('groupsPage.from.hint')}</p>

          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={copyRoster}
              onChange={(e) => setCopyRoster(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong text-accent-text focus:ring-accent"
            />
            {t('groupsPage.from.copyRoster')}
          </label>
          <p className="-mt-2 text-xs text-ink-secondary">{t('groupsPage.from.copyRosterHint')}</p>

          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={copyEvents}
              disabled={!activities || copyable.length === 0}
              onChange={(e) => setCopyEvents(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong text-accent-text focus:ring-accent"
            />
            {t('groupsPage.from.copyEvents')}
          </label>
          <p className="-mt-2 text-xs text-ink-secondary">
            {!activities
              ? t('groupsPage.from.loading')
              : copyable.length === 0
                ? t('groupsPage.from.noEvents')
                : t('groupsPage.from.copyEventsHint')}
          </p>

          {copyEvents && firstStart && (
            <div className="max-w-xs">
              <TextField
                label={t('groupsPage.from.firstEventOn')}
                type="date"
                required
                value={newFirstDate}
                onChange={(e) => setNewFirstDate(e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-secondary">
                {t('groupsPage.from.firstEventHint', {
                  when: firstStart.toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }),
                })}
              </p>
            </div>
          )}
        </>
      )}

      {error && <p className="text-sm text-tone-danger-fg">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving || (!!source && !activities)}>
          {saving ? t('groups.creating') : t('groups.createGroup')}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

function earliest(activities: Activity[]): Date | null {
  const live = activities.filter((a) => a.status !== 'cancelled');
  return live.length
    ? new Date(Math.min(...live.map((a) => new Date(a.startAt).getTime())))
    : null;
}
