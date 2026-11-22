import type { TransportMode } from '@meetingpnt/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import {
  CopyMultiDayFromExisting,
  type MultiDayCopy,
} from '../../components/CopyMultiDayFromExisting.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
import { Select } from '../../components/ui/Select.js';
import { TextArea, TextField } from '../../components/ui/TextField.js';
import { useToast } from '../../components/ui/Toast.js';
import { apiErrorMessage, useLocale, useTranslation } from '../../i18n/index.js';
import { addDays, daysBetween } from '../../lib/days.js';
import { useInheritedZone } from '../../lib/useInheritedZone.js';
import { inputToInstant } from '../../lib/zonedInput.js';

const TRANSPORT_MODES: TransportMode[] = ['walking', 'driving', 'bicycling', 'transit'];
const MAX_DAYS = 60;

/**
 * One event made of days: a trip, a workshop weekend. The leader gives the title and the dates;
 * each day becomes its own draft (own stops, own roll call) which they then plan. The days are
 * worked out here because only the browser knows the leader's time zone — an all-day trip is
 * stored as local-midnight instants.
 *
 * "Copy from existing" starts from a multi-day event in any of the leader's groups and creates this
 * one in the group the page is for: the length and the days' stops come from the source, so the end
 * date follows the start and the transport and reply settings are not asked again.
 */
export function MultiDayCreatePage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const showToast = useToast();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode>('walking');
  // Off by default: people booked the trip, they don't re-confirm each morning.
  const [requiresRsvp, setRequiresRsvp] = useState(false);
  const [copy, setCopy] = useState<MultiDayCopy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inheritedZone = useInheritedZone(groupId);

  const dayCount = copy
    ? copy.dayCount
    : startDate && endDate
      ? Math.max(0, daysBetween(startDate, endDate) + 1)
      : 0;

  function applyCopy(source: MultiDayCopy) {
    setCopy(source);
    setTitle(source.title);
    setDescription(source.description);
    setStartDate(source.newStart);
    setEndDate(addDays(source.newStart, source.dayCount - 1));
  }

  function changeStart(value: string) {
    setStartDate(value);
    // A copy keeps its length, so the end follows.
    if (copy && value) setEndDate(addDays(value, copy.dayCount - 1));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (copy) {
      setSubmitting(true);
      try {
        await activitiesApi.copyMultiDay(copy.sourceId, {
          groupId: groupId!,
          shiftDays: daysBetween(copy.sourceStart, startDate),
          title,
          description,
        });
        showToast(t('multiDay.copied'));
        navigate(`/groups/${groupId}`);
      } catch (err) {
        setError(apiErrorMessage(err, t('multiDay.failed')));
      } finally {
        setSubmitting(false);
      }
      return;
    }

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
            // Day boundaries on the group's clock, so a trip abroad starts at its own midnight.
            startAt: inputToInstant(day, '00:00:00', inheritedZone).toISOString(),
            endAt: inputToInstant(day, '23:59:59', inheritedZone).toISOString(),
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

      <div className="mt-6">
        <CopyMultiDayFromExisting onApply={applyCopy} />
        {copy && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink-secondary">
            <span>
              {t('multiDay.copyFrom.applied', { title: copy.title, count: copy.dayCount })}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCopy(null)}>
              {t('multiDay.copyFrom.stop')}
            </Button>
          </div>
        )}
      </div>

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
              onChange={(e) => changeStart(e.target.value)}
            />
            <TextField
              label={t('newActivity.endDate')}
              type="date"
              required
              disabled={copy !== null}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {copy && endDate && (
            <p className="text-sm text-ink-secondary">
              {t('multiDay.copyFrom.endsOn', {
                date: new Date(`${endDate}T12:00:00`).toLocaleDateString(locale),
              })}
            </p>
          )}
          {!copy && (
            <>
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
                  <span className="block text-sm font-medium text-ink">
                    {t('newActivity.approve')}
                  </span>
                  <span className="block text-sm text-ink-secondary">
                    {requiresRsvp ? t('newActivity.approveOn') : t('newActivity.approveOff')}
                  </span>
                </span>
              </label>
            </>
          )}
        </Card>

        {error && (
          <p className="rounded-md bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger-fg">{error}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-ink-secondary">
            {dayCount >= 1 && dayCount <= MAX_DAYS ? t('multiDay.daysSummary', { count: dayCount }) : ''}
          </p>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? t('newActivity.creating')
              : copy
                ? t('multiDay.copyFrom.create')
                : t('multiDay.create')}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
