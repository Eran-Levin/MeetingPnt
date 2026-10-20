import type { Activity, GroupWithRole } from '@meetingpnt/shared';
import { useEffect, useState } from 'react';
import { activitiesApi } from '../api/activitiesApi.js';
import { groupsApi } from '../api/groupsApi.js';
import { meetingPointsApi } from '../api/meetingPointsApi.js';
import { apiErrorMessage, useLocale, useTranslation } from '../i18n/index.js';
import { copyActivity, type ActivityCopy } from '../lib/copyActivity.js';
import { Button } from './ui/Button.js';
import { Card } from './ui/Card.js';
import { Select } from './ui/Select.js';
import { TextField } from './ui/TextField.js';

interface Props {
  onApply: (copy: ActivityCopy) => void;
}

/**
 * Start a new activity from one already planned — in this group or any other the leader runs.
 * Collapsed to a single button until wanted: most activities are still made from scratch.
 */
export function CopyFromExisting({ onApply }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<GroupWithRole[]>([]);
  const [groupId, setGroupId] = useState('');
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [activityId, setActivityId] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only groups they lead: a member can't plan from someone else's draft.
  useEffect(() => {
    if (!open || groups.length > 0) return;
    groupsApi
      .list()
      .then(({ groups }) => setGroups(groups.filter((g) => g.isLeader)))
      .catch((err) => setError(apiErrorMessage(err, t('activityForm.copy.failed'))));
  }, [open, groups.length, t]);

  useEffect(() => {
    setActivityId('');
    setActivities(null);
    if (!groupId) return;
    let stale = false;
    activitiesApi
      .list(groupId)
      .then(({ activities }) => {
        // Newest first: the one worth repeating is usually the last one run.
        if (!stale) setActivities([...activities].sort((a, b) => b.startAt.localeCompare(a.startAt)));
      })
      .catch((err) => !stale && setError(apiErrorMessage(err, t('activityForm.copy.failed'))));
    return () => {
      stale = true;
    };
  }, [groupId, t]);

  async function apply() {
    const source = activities?.find((a) => a.id === activityId);
    if (!source || !date) return;
    setBusy(true);
    setError(null);
    try {
      const { meetingPoints } = await meetingPointsApi.list(source.id);
      onApply(copyActivity(source, meetingPoints, date));
      setOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err, t('activityForm.copy.failed')));
    } finally {
      setBusy(false);
    }
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
      <p className="text-sm text-ink-secondary">{t('activityForm.copy.hint')}</p>

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
          label={t('activityForm.copy.activity')}
          value={activityId}
          onChange={(e) => setActivityId(e.target.value)}
          disabled={!activities || activities.length === 0}
        >
          <option value="">
            {groupId && !activities ? t('activityForm.copy.loading') : t('activityForm.copy.pickActivity')}
          </option>
          {(activities ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.title} · {new Date(a.startAt).toLocaleDateString(locale)}
            </option>
          ))}
        </Select>
      </div>

      {activities?.length === 0 && (
        <p className="text-sm text-ink-secondary">{t('activityForm.copy.noActivities')}</p>
      )}

      <TextField
        label={t('activityForm.copy.newDate')}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {error && (
        <p className="rounded-md bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger-fg">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={apply} disabled={busy || !activityId || !date}>
          {t('activityForm.copy.apply')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t('activityForm.copy.cancel')}
        </Button>
      </div>
    </Card>
  );
}
