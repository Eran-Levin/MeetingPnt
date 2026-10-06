import type { MeetingPointTemplateDto, TransportMode } from '@meetingpnt/shared';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { apiErrorMessage, useLocale, useTranslation } from '../../i18n/index.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
import { Select } from '../../components/ui/Select.js';
import { TextArea, TextField } from '../../components/ui/TextField.js';

const TRANSPORT_MODES: TransportMode[] = ['driving', 'walking', 'bicycling', 'transit'];

function emptyTemplate(): MeetingPointTemplateDto {
  return { label: '', googleMapsUrl: '', offsetMinutes: 0 };
}

export function ActivityCreatePage() {
  const { t } = useTranslation();
  const locale = useLocale();
  // 2023-01-01 was a Sunday, so day 0 lines up with the `daysOfWeek` the server expects.
  const weekdayLabels = Array.from({ length: 7 }, (_, day) =>
    new Date(2023, 0, 1 + day).toLocaleDateString(locale, { weekday: 'short' }),
  );
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Timed activities are entered as one date plus two clock times; all-day ones as two dates.
  const [allDay, setAllDay] = useState(false);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode>('driving');
  const [requiresRsvp, setRequiresRsvp] = useState(true);
  const [singleLocation, setSingleLocation] = useState(false);
  const [repeats, setRepeats] = useState(false);
  const [intervalWeeks, setIntervalWeeks] = useState('1');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [endType, setEndType] = useState<'count' | 'until'>('count');
  const [count, setCount] = useState('8');
  const [until, setUntil] = useState('');
  const [meetingPoints, setMeetingPoints] = useState<MeetingPointTemplateDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  function updateMeetingPoint(index: number, patch: Partial<MeetingPointTemplateDto>) {
    setMeetingPoints((prev) => prev.map((mp, i) => (i === index ? { ...mp, ...patch } : mp)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (repeats && daysOfWeek.length === 0) {
      setError(t('newActivity.pickDay'));
      return;
    }

    // All-day activities cover whole days; timed ones share a date and differ only by clock time.
    const start = allDay ? new Date(`${date}T00:00:00`) : new Date(`${date}T${startTime}`);
    const end = allDay ? new Date(`${endDate || date}T23:59:59`) : new Date(`${date}T${endTime}`);

    if (end <= start) {
      setError(
        allDay ? t('newActivity.endDateBeforeStart') : t('newActivity.endTimeBeforeStart'),
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await activitiesApi.create(groupId!, {
        title,
        description: description || undefined,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        allDay,
        transportMode,
        requiresRsvp,
        singleLocation,
        recurrence: repeats
          ? {
              frequency: 'weekly',
              intervalWeeks: Number(intervalWeeks) || 1,
              daysOfWeek,
              endType,
              count: endType === 'count' ? Number(count) : undefined,
              until: endType === 'until' ? new Date(until).toISOString() : undefined,
            }
          : undefined,
        meetingPoints: meetingPoints.length > 0 ? meetingPoints : undefined,
      });

      if ('activities' in result) {
        navigate(`/groups/${groupId}`);
      } else {
        navigate(`/activities/${result.activity.id}`);
      }
    } catch (err) {
      setError(apiErrorMessage(err, t('newActivity.failed')));
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
      <h1 className="mt-2 text-2xl font-semibold text-ink">{t('newActivity.title')}</h1>
      <p className="mt-1 text-sm text-ink-secondary">{t('activityForm.subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
        <FormSection title={t('activityForm.what')}>
          <TextField
            label={t('newActivity.fieldTitle')}
            required
            placeholder={t('newActivity.titlePlaceholder')}
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
        </FormSection>

        <FormSection title={t('newActivity.when')}>
          <CheckboxRow
            label={t('newActivity.spansDays')}
            hint={t('activityForm.hintSpans')}
            checked={allDay}
            onChange={setAllDay}
          />

          {allDay ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={repeats ? t('activityForm.firstStart') : t('newActivity.startDate')}
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <TextField
                label={t('newActivity.endDate')}
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextField
                label={repeats ? t('activityForm.firstDate') : t('newActivity.date')}
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <TextField
                label={t('newActivity.startTime')}
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <TextField
                label={t('newActivity.endTime')}
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          )}
        </FormSection>

        <FormSection title={t('newActivity.attendance')}>
          {/* Off is how a trip day works: people booked the trip, so they don't re-confirm each
              morning — but they can still decline the one day they're sitting out. */}
          <CheckboxRow
            label={t('newActivity.approve')}
            hint={requiresRsvp ? t('newActivity.approveOn') : t('newActivity.approveOff')}
            checked={requiresRsvp}
            onChange={setRequiresRsvp}
          />
        </FormSection>

        <FormSection title={t('newActivity.repeat')}>
          <CheckboxRow
            label={t('newActivity.repeatWeekly')}
            hint={t('activityForm.hintRepeat')}
            checked={repeats}
            onChange={setRepeats}
          />

          {repeats && (
            <div className="flex flex-col gap-4 rounded-lg bg-surface-sunken p-4">
              <label className="flex flex-wrap items-center gap-2 text-sm text-ink">
                {t('newActivity.every')}
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={intervalWeeks}
                  onChange={(e) => setIntervalWeeks(e.target.value)}
                  className="w-16 rounded-lg border border-line-strong bg-surface px-2 py-1 text-sm"
                />
                {t('activityForm.weeksOn')}
              </label>
              <div className="flex flex-wrap gap-2">
                {weekdayLabels.map((label, day) => (
                  <button
                    type="button"
                    key={day}
                    aria-pressed={daysOfWeek.includes(day)}
                    onClick={() => toggleDay(day)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      daysOfWeek.includes(day)
                        ? 'border-accent bg-accent text-white'
                        : 'border-line-strong bg-surface text-ink hover:bg-surface-raised'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="flex flex-wrap items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  checked={endType === 'count'}
                  onChange={() => setEndType('count')}
                  className="h-4 w-4 text-accent-text focus:ring-accent"
                />
                {t('newActivity.for')}
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  disabled={endType !== 'count'}
                  className="w-16 rounded-lg border border-line-strong bg-surface px-2 py-1 text-sm disabled:bg-surface-raised disabled:text-ink-muted"
                />
                {t('newActivity.occurrences')}
              </label>
              <label className="flex flex-wrap items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  checked={endType === 'until'}
                  onChange={() => setEndType('until')}
                  className="h-4 w-4 text-accent-text focus:ring-accent"
                />
                {t('activityForm.until')}
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  disabled={endType !== 'until'}
                  className="rounded-lg border border-line-strong bg-surface px-2 py-1 text-sm disabled:bg-surface-raised disabled:text-ink-muted"
                />
              </label>
            </div>
          )}
        </FormSection>

        {/* The first one is "the meeting point" — where everybody gathers. Only once that exists
            does the idea of a route, and of further stops, mean anything. A single-location event
            never gets past that first one. */}
        <FormSection
          title={meetingPoints.length > 1 ? t('activityForm.meetingPoints') : t('common.meetingPoint')}
          description={t('activityForm.meetingPointsHint')}
          action={
            (singleLocation ? meetingPoints.length === 0 : true) && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setMeetingPoints((prev) => [...prev, emptyTemplate()])}
              >
                {meetingPoints.length === 0 ? t('activityForm.addPoint') : t('activityForm.addStop')}
              </Button>
            )
          }
        >
          <CheckboxRow
            label={t('newActivity.single')}
            hint={t('activityForm.singleHint')}
            checked={singleLocation}
            onChange={(value) => {
              setSingleLocation(value);
              // Dropping back to one place shouldn't silently discard a route the leader typed —
              // but keeping five stops on an event that claims to have one is worse.
              if (value) setMeetingPoints((prev) => prev.slice(0, 1));
            }}
          />
          {repeats && meetingPoints.length > 0 && (
            <p className="text-xs text-ink-secondary">{t('activityForm.appliedToAll')}</p>
          )}

          {meetingPoints.map((mp, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface-sunken p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {i === 0 ? t('common.meetingPoint') : t('activityForm.stopN', { n: i + 1 })}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMeetingPoints((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  {t('groupPage.remove')}
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <TextField
                  label={t('meetingPointEditor.labelOptional')}
                  value={mp.label ?? ''}
                  onChange={(e) => updateMeetingPoint(i, { label: e.target.value })}
                />
                <TextField
                  label={t('activityForm.minutesFromStart')}
                  type="number"
                  value={mp.offsetMinutes}
                  onChange={(e) => updateMeetingPoint(i, { offsetMinutes: Number(e.target.value) })}
                  className="sm:w-40"
                />
              </div>
              <div className="mt-3">
                <TextField
                  label={t('meetingPointEditor.mapsUrl')}
                  required
                  value={mp.googleMapsUrl}
                  onChange={(e) => updateMeetingPoint(i, { googleMapsUrl: e.target.value })}
                />
              </div>
            </div>
          ))}
        </FormSection>

        {error && (
          <p className="rounded-md bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger-fg">
            {error}
          </p>
        )}

        {/* What the button is about to do, spelled out — the recurrence rules add up to a number
            of drafts that is otherwise invisible until they land in the group. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-ink-secondary">
            {summarise({
              t,
              weekdayLabels,
              locale,
              repeats,
              daysOfWeek,
              intervalWeeks,
              endType,
              count,
              until,
              meetingPoints,
            })}
          </p>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? t('newActivity.creating')
              : repeats
                ? t('newActivity.createSeries')
                : t('newActivity.createDraft')}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

function summarise({
  t,
  weekdayLabels,
  locale,
  repeats,
  daysOfWeek,
  intervalWeeks,
  endType,
  count,
  until,
  meetingPoints,
}: {
  t: TFunction;
  weekdayLabels: string[];
  locale: string;
  repeats: boolean;
  daysOfWeek: number[];
  intervalWeeks: string;
  endType: 'count' | 'until';
  count: string;
  until: string;
  meetingPoints: MeetingPointTemplateDto[];
}): string {
  const stops =
    meetingPoints.length > 0 ? t('activityForm.summary.stops', { count: meetingPoints.length }) : '';

  if (!repeats) return t('activityForm.summary.one', { stops });

  if (daysOfWeek.length === 0) return t('activityForm.summary.pickDays');

  const days = daysOfWeek.map((d) => weekdayLabels[d]).join(', ');
  const every =
    Number(intervalWeeks) > 1
      ? t('activityForm.summary.everyN', { count: Number(intervalWeeks) })
      : t('activityForm.summary.weekly');
  const howMany =
    endType === 'count'
      ? t('activityForm.summary.drafts', { count: Number(count) })
      : until
        ? t('activityForm.summary.draftsUntil', {
            date: new Date(until).toLocaleDateString(locale),
          })
        : t('activityForm.summary.draftsPlain');

  return t('activityForm.summary.repeat', { howMany, every, days, stops });
}

/** A titled group of fields. The form was one undivided run of twelve controls. */
function FormSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
        {action}
      </div>
      {description && <p className="mt-1 text-sm text-ink-secondary">{description}</p>}
      <Card className="mt-2 flex flex-col gap-4">{children}</Card>
    </section>
  );
}

/** A checkbox with its consequence written underneath, because every one of these changes what
    members experience rather than just what's stored. */
function CheckboxRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-line-strong text-accent-text focus:ring-accent"
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-sm text-ink-secondary">{hint}</span>
      </span>
    </label>
  );
}
