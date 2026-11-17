import type { TransportMode } from '@meetingpnt/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
import { Select } from '../../components/ui/Select.js';
import { TextArea, TextField } from '../../components/ui/TextField.js';
import { apiErrorMessage, useTranslation } from '../../i18n/index.js';

const TRANSPORT_MODES: TransportMode[] = ['walking', 'driving', 'bicycling', 'transit'];
const MAX_DAYS = 60;

/**
 * One event made of days: a trip, a workshop weekend. The leader gives the title and the dates;
 * each day becomes its own draft (own stops, own roll call) which they then plan. The days are
 * worked out here because only the browser knows the leader's time zone — an all-day trip is
 * stored as local-midnight instants.
 */
export function MultiDayCreatePage() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode>('walking');
  // Off by default: people booked the trip, they don't re-confirm each morning.
  const [requiresRsvp, setRequiresRsvp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dayCount = daysBetween(startDate, endDate);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (dayCount < 1) {
      setError(t('newActivity.endDateBeforeStart'));
      return;
    }
    if (dayCount > MAX_DAYS) {
      setError(t('multiDay.tooLong'));
      return;
    }

    setSubmitting(true);
    try {
      await activitiesApi.createMultiDay(groupId!, {
        title,
        description: description || undefined,
        days: Array.from({ length: dayCount }, (_, index) => {
          const day = addDays(startDate, index);
          return {
            title: t('multiDay.dayTitle', { title, n: index + 1 }),
            startAt: new Date(`${day}T00:00:00`).toISOString(),
            endAt: new Date(`${day}T23:59:59`).toISOString(),
          };
        }),
        transportMode,
        requiresRsvp,
      });
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(apiErrorMessage(err, t('multiDay.failed')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <Link to={`/groups/${groupId}`} className="text-sm text-accent-text hover:underline">
        <span aria-hidden="true" className="inline-block rtl:rotate-180">←</span>{' '}
        {t('activityForm.back')}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-ink">{t('multiDay.title')}</h1>
      <p className="mt-1 text-sm text-ink-secondary">{t('multiDay.subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
        <Card className="flex flex-col gap-4">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t('newActivity.startDate')}
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <TextField
              label={t('newActivity.endDate')}
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
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
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={requiresRsvp}
              onChange={(e) => setRequiresRsvp(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line-strong text-accent-text focus:ring-accent"
            />
            <span>
              <span className="block text-sm font-medium text-ink">{t('newActivity.approve')}</span>
              <span className="block text-sm text-ink-secondary">
                {requiresRsvp ? t('newActivity.approveOn') : t('newActivity.approveOff')}
              </span>
            </span>
          </label>
        </Card>

        {error && (
          <p className="rounded-md bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger-fg">{error}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-ink-secondary">
            {dayCount >= 1 && dayCount <= MAX_DAYS ? t('multiDay.daysSummary', { count: dayCount }) : ''}
          </p>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('newActivity.creating') : t('multiDay.create')}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

/** Whole days from `start` to `end` inclusive (`YYYY-MM-DD`); 0 when either is missing or reversed. */
function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  // Noon, so a daylight-saving change inside the range can't push the count off by one.
  const from = new Date(`${start}T12:00:00`);
  const to = new Date(`${end}T12:00:00`);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return days > 0 ? days : 0;
}

/** `YYYY-MM-DD` plus a number of calendar days, in the browser's own time zone. */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
