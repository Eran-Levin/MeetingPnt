import type { ActivityWithGroup } from '@meetingpnt/shared';
import { formatActivityWhen, formatWeekdayShort, joinDot } from '@meetingpnt/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { activitiesApi } from '../../api/activitiesApi.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { PageContainer } from '../../components/ui/PageContainer.js';
import { EmptyState, SkeletonRows } from '../../components/ui/Skeleton.js';
import { useLocale, useTranslation } from '../../i18n/index.js';

/**
 * Everything scheduled, across every group, in the order it happens.
 *
 * The group page answers "what's this group doing"; this answers "what am I doing" — which is the
 * question a leader running three groups actually has, and which the group list can't answer
 * because it splits the same week across three pages.
 */
export function ActivitiesPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const [showPast, setShowPast] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['activities', 'mine'],
    queryFn: () => activitiesApi.listMine(),
  });

  const activities = data?.activities ?? [];
  const now = Date.now();

  // The clock decides what's past, not the status: a published event nobody started or ended keeps
  // that status forever, and would otherwise sit at the top of the list months later.
  const hasEnded = (a: ActivityWithGroup) => new Date(a.endAt).getTime() < now;
  const live = activities.filter((a) => a.status === 'in_progress');
  const upcoming = activities.filter((a) => a.status !== 'in_progress' && !hasEnded(a));
  const past = activities
    .filter((a) => a.status !== 'in_progress' && hasEnded(a))
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  // Month headings, because a yoga term is twenty near-identical rows with nothing to navigate by.
  const months: { label: string; items: ActivityWithGroup[] }[] = [];
  for (const activity of upcoming) {
    const label = new Date(activity.startAt).toLocaleDateString(locale, {
      month: 'long',
      year: 'numeric',
    });
    const bucket = months.find((m) => m.label === label);
    if (bucket) bucket.items.push(activity);
    else months.push({ label, items: [activity] });
  }

  return (
    <PageContainer wide>
      <h1 className="text-2xl font-semibold text-ink">{t('groupDetail.activities')}</h1>
      <p className="mt-1 text-sm text-ink-secondary">{t('activitiesPage.subtitle')}</p>

      {isLoading && (
        <div className="mt-8">
          <SkeletonRows rows={4} />
        </div>
      )}

      {live.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            {t('activitiesPage.happeningNow')}
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {live.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} accent />
            ))}
          </div>
        </section>
      )}

      {months.map((month) => (
        <section key={month.label} className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            {month.label} <span className="text-line-strong">({month.items.length})</span>
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {month.items.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        </section>
      ))}

      {!isLoading && upcoming.length === 0 && live.length === 0 && (
        <div className="mt-8">
          <EmptyState
            headline={t('calendar.emptyHeadline')}
            body={t('activitiesPage.emptyBody')}
          />
        </div>
      )}

      {past.length > 0 && (
        <section className="mt-10 border-t border-line pt-6">
          <Button variant="secondary" size="sm" onClick={() => setShowPast((v) => !v)}>
            {showPast ? t('calendar.hidePast') : t('activitiesPage.showPast', { count: past.length })}
          </Button>
          {showPast && (
            <div className="mt-3 flex flex-col gap-3">
              {past.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} muted />
              ))}
            </div>
          )}
        </section>
      )}
    </PageContainer>
  );
}

function ActivityRow({
  activity,
  accent = false,
  muted = false,
}: {
  activity: ActivityWithGroup;
  accent?: boolean;
  muted?: boolean;
}) {
  const locale = useLocale();
  const start = new Date(activity.startAt);

  return (
    <Link to={`/activities/${activity.id}`}>
      <Card
        className={`flex flex-wrap items-center gap-4 transition-shadow hover:shadow-md ${
          accent ? 'border-accent bg-accent-surface' : ''
        } ${muted ? 'opacity-70' : ''}`}
      >
        {/* A date block rather than a sentence — the point of this page is scanning down it. */}
        <div className="w-12 shrink-0 text-center">
          <p className="text-xs uppercase text-ink-muted">{formatWeekdayShort(start, locale)}</p>
          <p className="text-xl font-semibold text-ink">{start.getDate()}</p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{activity.title}</p>
          <p className="truncate text-sm text-ink-secondary">
            {joinDot([
              activity.group.name,
              formatActivityWhen(activity.startAt, activity.endAt, activity.allDay, locale),
            ])}
          </p>
        </div>

        <Badge status={activity.status} />
      </Card>
    </Link>
  );
}
