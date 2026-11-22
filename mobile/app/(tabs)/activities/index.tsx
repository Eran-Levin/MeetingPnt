import type { ActivityWithGroup } from '@meetingpnt/shared';
import { formatActivityWhen, formatWeekdayShort, isolate, joinDot } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { activitiesApi } from '../../../src/api/activitiesApi';
import { rsvpsApi } from '../../../src/api/rsvpsApi';
import { useLocale, useTranslation } from '../../../src/i18n';
import { useAuthStore } from '../../../src/store/authStore';
import {
  Badge,
  Button,
  ButtonRow,
  Card,
  DateBlock,
  Empty,
  Pill,
  Row,
  Screen,
  Section,
  color,
  space,
  text,
} from '../../../src/ui';

/**
 * Only chase a reply while it can still change anything — no point nagging about an event that
 * has already finished or been cancelled.
 */
function needsReply(activity: ActivityWithGroup): boolean {
  if (activity.isLeader) return false;
  if (activity.myRsvpStatus === 'approved' || activity.myRsvpStatus === 'declined') return false;
  if (activity.status !== 'published' && activity.status !== 'in_progress') return false;
  return new Date(activity.endAt).getTime() >= Date.now();
}

/** Starting is a today thing — a row for next month doesn't need the button. */
function startableToday(activity: ActivityWithGroup): boolean {
  if (!activity.isLeader || activity.status !== 'published') return false;
  const start = new Date(activity.startAt);
  const today = new Date();
  return start.toDateString() === today.toDateString();
}

const NEAR_TERM_DAYS = 7;

/**
 * Events fall under "this week", then under the month they happen in. A twice-weekly yoga term is
 * otherwise twenty near-identical rows with nothing to navigate by, and a guide with a September
 * departure is reading about September in August.
 */
function bucketFor(
  activity: ActivityWithGroup,
  nearTermCutoff: number,
  thisWeek: string,
  locale: string,
): string {
  if (new Date(activity.startAt).getTime() <= nearTermCutoff) return thisWeek;
  return new Date(activity.startAt)
    .toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    .toUpperCase();
}

export default function CalendarScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [dismissedOverdueId, setDismissedOverdueId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const leads = user?.role === 'leader' || user?.role === 'admin';

  const { data, isFetching } = useQuery({
    queryKey: ['activities', 'mine'],
    queryFn: () => activitiesApi.listMine(),
  });

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['activities', 'mine'] });
    }, [queryClient]),
  );

  const activities = data?.activities ?? [];
  const now = Date.now();

  /**
   * The clock decides what's past, not the status: a published event nobody ever started or ended
   * keeps that status forever, and would otherwise sit at the top of the calendar months later.
   * The running event is deliberately absent — it lives in the bar above the tabs now.
   */
  const hasEnded = (a: ActivityWithGroup) => new Date(a.endAt).getTime() < now;
  const upcoming = activities.filter((a) => a.status !== 'in_progress' && !hasEnded(a));
  const past = activities
    .filter((a) => a.status !== 'in_progress' && hasEnded(a))
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  /**
   * A leader who walked away without ending the event: it stays in_progress indefinitely, keeps
   * location sharing open for everyone on the roster, and blocks starting the next one — a leader
   * runs one at a time. So ask, once, on the screen they land on. Only the leader is asked; a
   * member can't end anything, and for them the event simply carries on.
   */
  const overdueLive = activities.find(
    (a) => a.isLeader && a.status === 'in_progress' && new Date(a.endAt).getTime() < now,
  );
  const askToClose = overdueLive && overdueLive.id !== dismissedOverdueId ? overdueLive : null;

  /**
   * A multi-day event is one card, led by its next day — today's, while the trip is on. The rest
   * of its days are one tap away under the card rather than a card each: a week-long trek was
   * seven rows standing in for a single thing.
   */
  const upcomingDays = new Map<string, ActivityWithGroup[]>();
  for (const activity of upcoming) {
    if (!activity.multiDay) continue;
    upcomingDays.set(activity.multiDay.id, [...(upcomingDays.get(activity.multiDay.id) ?? []), activity]);
  }
  const cards = upcoming.filter(
    (activity) => !activity.multiDay || upcomingDays.get(activity.multiDay.id)![0] === activity,
  );

  /** Finished multi-day events collapse the same way: one row, opening the last day. */
  const pastRows: { key: string; lead: ActivityWithGroup; days: number }[] = [];
  for (const activity of past) {
    const existing = activity.multiDay && pastRows.find((r) => r.key === activity.multiDay!.id);
    if (existing) existing.days += 1;
    else pastRows.push({ key: activity.multiDay?.id ?? activity.id, lead: activity, days: 1 });
  }

  const nearTermCutoff = now + NEAR_TERM_DAYS * 24 * 60 * 60 * 1000;
  const buckets: { label: string; items: ActivityWithGroup[] }[] = [];
  for (const activity of cards) {
    const label = bucketFor(activity, nearTermCutoff, t('calendar.thisWeek'), locale);
    const bucket = buckets.find((b) => b.label === label);
    if (bucket) bucket.items.push(activity);
    else buckets.push({ label, items: [activity] });
  }

  function open(activity: ActivityWithGroup) {
    router.push(`/(tabs)/groups/${activity.groupId}/activities/${activity.id}`);
  }

  /** Start and go straight into the event — the leader's next move is always to manage it. */
  async function handleStart(activity: ActivityWithGroup) {
    setStartingId(activity.id);
    try {
      await activitiesApi.start(activity.id);
      queryClient.invalidateQueries({ queryKey: ['activities', 'mine'] });
      open(activity);
    } finally {
      setStartingId(null);
    }
  }

  /** Ends the event the leader forgot to close, from the prompt on this screen. */
  async function handleEnd(activity: ActivityWithGroup) {
    setEndingId(activity.id);
    try {
      await activitiesApi.end(activity.id);
      queryClient.invalidateQueries({ queryKey: ['activities', 'mine'] });
    } finally {
      setEndingId(null);
    }
  }

  function EventRow({ activity, last }: { activity: ActivityWithGroup; last: boolean }) {
    const start = new Date(activity.startAt);
    const multiDay = activity.multiDay;
    const days = multiDay ? (upcomingDays.get(multiDay.id) ?? []) : [];
    const expanded = multiDay ? expandedEvents.has(multiDay.id) : false;
    // One reply for the whole trip, offered while any of its coming days is still unanswered —
    // otherwise a member would open and answer five days one by one.
    // A day that has started is locked (the server skips it), so it can't keep the buttons up.
    const owesReply =
      multiDay !== null &&
      days.some((day) => needsReply(day) && new Date(day.startAt).getTime() >= now);
    return (
      <View>
        <Row
          title={multiDay ? multiDay.title : activity.title}
          subtitle={joinDot([
            activity.group.name,
            multiDay && t('calendar.dayOfCount', { n: multiDay.dayNumber, count: multiDay.dayCount }),
            formatActivityWhen(activity.startAt, activity.endAt, activity.allDay, locale, activity.effectiveTimeZone),
          ])}
          leading={
            <DateBlock weekday={formatWeekdayShort(start, locale)} day={String(start.getDate())} />
          }
          onPress={() => open(activity)}
          last={last}
        />
        <View style={styles.rowExtras}>
          {activity.status === 'draft' && <Badge status="draft" />}
          {needsReply(activity) && !(multiDay && owesReply) && (
            <Pill tone="warning" label={t('calendar.replyNeeded')} />
          )}
          {startableToday(activity) && (
            <Button
              label={
                startingId === activity.id ? t('calendar.starting') : t('calendar.startActivity')
              }
              onPress={() => handleStart(activity)}
              busy={startingId === activity.id}
              style={styles.startButton}
            />
          )}
        </View>
        {multiDay && owesReply && (
          <View style={styles.rowExtras}>
            <ButtonRow>
              <Button
                label={t('calendar.comingAllDays')}
                onPress={() => handleReplyAll(multiDay.id, 'approved')}
                busy={replyingId === multiDay.id}
                grow
              />
              <Button
                label={t('calendar.cantMakeIt')}
                variant="secondary"
                onPress={() => handleReplyAll(multiDay.id, 'declined')}
                busy={replyingId === multiDay.id}
                grow
              />
            </ButtonRow>
          </View>
        )}
        {multiDay && days.length > 1 && (
          <Pressable onPress={() => toggleExpanded(multiDay.id)} style={styles.toggle}>
            <Text style={[text.secondary, { color: color.accentText }]}>
              {expanded ? t('calendar.hideDays') : t('calendar.showDays')}
            </Text>
          </Pressable>
        )}
        {expanded &&
          days.map((day, index) => (
            <Row
              key={day.id}
              title={day.title}
              subtitle={joinDot([
                t('calendar.dayOfCount', { n: day.multiDay!.dayNumber, count: day.multiDay!.dayCount }),
                formatActivityWhen(day.startAt, day.endAt, day.allDay, locale, day.effectiveTimeZone),
              ])}
              onPress={() => open(day)}
              last={index === days.length - 1}
            />
          ))}
      </View>
    );
  }

  /** Answers every day of the trip that hasn't started, then refreshes the timeline. */
  async function handleReplyAll(multiDayId: string, status: 'approved' | 'declined') {
    setReplyingId(multiDayId);
    try {
      await rsvpsApi.replyToMultiDay(multiDayId, status);
      queryClient.invalidateQueries({ queryKey: ['activities', 'mine'] });
    } catch {
      Alert.alert(t('calendar.replyAllFailed'));
    } finally {
      setReplyingId(null);
    }
  }

  function toggleExpanded(multiDayId: string) {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (!next.delete(multiDayId)) next.add(multiDayId);
      return next;
    });
  }

  return (
    <Screen
      title={leads ? t('tabs.calendar') : t('tabs.yourActivities')}
      back={false}
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['activities', 'mine'] })}
      refreshing={isFetching}
      bottomInset={80}
    >
      {askToClose && (
        <Card style={styles.askToClose}>
          <Text style={text.bodyStrong}>
            {t('calendar.stillRunning', { title: isolate(askToClose.title) })}
          </Text>
          <Text style={[text.secondary, styles.askToCloseBody]}>
            {t('calendar.overdueBody', {
              when: formatActivityWhen(askToClose.startAt, askToClose.endAt, askToClose.allDay, locale, askToClose.effectiveTimeZone),
            })}
          </Text>
          <ButtonRow>
            <Button
              label={endingId === askToClose.id ? t('calendar.ending') : t('calendar.endActivity')}
              onPress={() => handleEnd(askToClose)}
              busy={endingId === askToClose.id}
              grow
            />
            <Button
              label={t('calendar.keepRunning')}
              variant="secondary"
              onPress={() => setDismissedOverdueId(askToClose.id)}
              grow
            />
          </ButtonRow>
        </Card>
      )}

      {buckets.map((bucket, i) => (
        <Section key={bucket.label} label={bucket.label} first={i === 0}>
          {bucket.items.map((activity, index) => (
            <EventRow
              key={activity.id}
              activity={activity}
              last={index === bucket.items.length - 1}
            />
          ))}
        </Section>
      ))}

      {buckets.length === 0 && (
        <Empty
          headline={t('calendar.emptyHeadline')}
          body={t('calendar.emptyBody')}
        />
      )}

      {pastRows.length > 0 && (
        <Section label={t('calendar.earlier', { count: pastRows.length })}>
          <Pressable onPress={() => setShowPast((v) => !v)} style={styles.toggle}>
            <Text style={[text.secondary, { color: color.accentText }]}>
              {showPast ? t('calendar.hidePast') : t('calendar.showPast')}
            </Text>
          </Pressable>
          {showPast &&
            pastRows.map(({ key, lead, days }, index) => (
              <Row
                key={key}
                title={lead.multiDay ? lead.multiDay.title : lead.title}
                subtitle={joinDot([
                  lead.group.name,
                  lead.multiDay
                    ? t('calendar.pastDays', { count: days })
                    : formatActivityWhen(lead.startAt, lead.endAt, lead.allDay, locale, lead.effectiveTimeZone),
                ])}
                onPress={() => open(lead)}
                done
                last={index === pastRows.length - 1}
              />
            ))}
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  askToClose: { marginBottom: space.lg },
  askToCloseBody: { marginTop: space.xs, marginBottom: space.md },
  rowExtras: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  startButton: { flexGrow: 1 },
  toggle: { paddingVertical: space.sm },
});
