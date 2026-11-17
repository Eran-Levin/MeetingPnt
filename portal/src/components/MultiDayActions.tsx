import { isolate, type Activity, type MultiDayEvent } from '@meetingpnt/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { activitiesApi } from '../api/activitiesApi.js';
import { apiErrorMessage, useTranslation } from '../i18n/index.js';
import { Button } from './ui/Button.js';
import { TextArea, TextField } from './ui/TextField.js';
import { useToast } from './ui/Toast.js';

type Mode = 'edit' | 'move' | 'copy';

/**
 * What a leader can do to a whole multi-day event: rename it, slide it to other dates, run it again
 * as a copy, or delete it. The days themselves are still edited one by one, on their own pages.
 *
 * Moving and deleting are only offered while no day has started — once one is running or over it is
 * a record (the server refuses too; hiding the button just spares the error).
 */
export function MultiDayActions({
  event,
  days,
}: {
  event: MultiDayEvent;
  days: Activity[];
}) {
  const { t } = useTranslation();
  const showToast = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode | null>(null);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? '');
  const [copyTitle, setCopyTitle] = useState(event.title);
  const firstDay = localDate(days[0]!.startAt);
  const [newStart, setNewStart] = useState(firstDay);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notStarted = days.every((d) => d.status === 'draft' || d.status === 'published');
  const noneRunningOrOver = days.every((d) => d.status !== 'in_progress' && d.status !== 'completed');

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['groups', event.groupId, 'activities'] });
    queryClient.invalidateQueries({ queryKey: ['groups', event.groupId, 'multi-day-events'] });
  }

  function open(next: Mode) {
    setError(null);
    setTitle(event.title);
    setDescription(event.description ?? '');
    setCopyTitle(event.title);
    setNewStart(firstDay);
    setMode(mode === next ? null : next);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setMode(null);
      refresh();
    } catch (err) {
      setError(apiErrorMessage(err, t('multiDay.actionFailed')));
    } finally {
      setBusy(false);
    }
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const shift = daysBetween(firstDay, newStart);

  const savedToast = (invited: number) =>
    showToast(invited > 0 ? t('publishToast.updated', { count: invited }) : t('publishToast.saved'));

  async function handleDelete() {
    const confirmed = window.confirm(
      t('multiDay.confirmDelete', { title: isolate(event.title), count: days.length }),
    );
    if (!confirmed) return;
    await run(async () => {
      const { invited } = await activitiesApi.removeMultiDay(event.id);
      showToast(
        invited > 0 ? t('publishToast.cancelled', { count: invited }) : t('publishToast.deleted'),
      );
    });
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={mode === 'edit' ? 'primary' : 'secondary'} onClick={() => open('edit')}>
          {t('multiDay.edit')}
        </Button>
        {notStarted && (
          <Button size="sm" variant={mode === 'move' ? 'primary' : 'secondary'} onClick={() => open('move')}>
            {t('multiDay.move')}
          </Button>
        )}
        <Button size="sm" variant={mode === 'copy' ? 'primary' : 'secondary'} onClick={() => open('copy')}>
          {t('multiDay.copy')}
        </Button>
        {noneRunningOrOver && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={handleDelete}>
            {t('multiDay.delete')}
          </Button>
        )}
      </div>

      {mode === 'edit' && (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const { invited } = await activitiesApi.updateMultiDay(event.id, {
                title,
                description,
              });
              savedToast(invited);
            });
          }}
        >
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
          <FormButtons busy={busy} label={t('common.save')} onCancel={() => setMode(null)} />
        </form>
      )}

      {mode === 'move' && (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const { invited } = await activitiesApi.moveMultiDay(event.id, {
                shiftDays: shift,
                timeZone,
              });
              savedToast(invited);
            });
          }}
        >
          <p className="text-sm text-ink-secondary">{t('multiDay.moveHint')}</p>
          <TextField
            label={t('multiDay.newStart')}
            type="date"
            required
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
          />
          <FormButtons
            busy={busy}
            disabled={shift === 0}
            label={t('multiDay.moveAction')}
            onCancel={() => setMode(null)}
          />
        </form>
      )}

      {mode === 'copy' && (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await activitiesApi.copyMultiDay(event.id, {
                shiftDays: shift,
                timeZone,
                title: copyTitle,
              });
              showToast(t('multiDay.copied'));
            });
          }}
        >
          <p className="text-sm text-ink-secondary">{t('multiDay.copyHint')}</p>
          <TextField
            label={t('multiDay.copyTitle')}
            required
            value={copyTitle}
            onChange={(e) => setCopyTitle(e.target.value)}
          />
          <TextField
            label={t('multiDay.newStart')}
            type="date"
            required
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
          />
          <FormButtons busy={busy} label={t('multiDay.copyAction')} onCancel={() => setMode(null)} />
        </form>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger-fg">{error}</p>
      )}
    </div>
  );
}

function FormButtons({
  busy,
  disabled,
  label,
  onCancel,
}: {
  busy: boolean;
  disabled?: boolean;
  label: string;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2">
      <Button type="submit" size="sm" disabled={busy || disabled}>
        {busy ? t('multiDay.working') : label}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
    </div>
  );
}

/** The browser-local calendar day of an instant, as `YYYY-MM-DD`. All-day days are stored as the
 * leader's local midnight, so this is the day they picked. */
function localDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Signed whole days from `from` to `to` (`YYYY-MM-DD`). Noon, so a daylight-saving change in
 * between can't push the count off by one. */
function daysBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  return Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000,
  );
}
