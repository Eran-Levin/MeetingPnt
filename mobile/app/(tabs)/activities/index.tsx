import type { ActivityWithGroup } from '@meetingpnt/shared';
import { formatActivityWhen } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { activitiesApi } from '../../../src/api/activitiesApi';
import { authApi } from '../../../src/api/authApi';
import { secureStore } from '../../../src/services/secureStore';
import { endSession } from '../../../src/services/session';
import {
  Badge,
  Button,
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

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const NEAR_TERM_DAYS = 7;

/**
 * Events fall under "this week", then under the month they happen in. A twice-weekly yoga term is
 * otherwise twenty near-identical rows with nothing to navigate by, and a guide with a September
 * departure is reading about September in August.
 */
function bucketFor(activity: ActivityWithGroup, nearTermCutoff: number): string {
  if (new Date(activity.startAt).getTime() <= nearTermCutoff) return 'This week';
  return new Date(activity.startAt)
    .toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    .toUpperCase();
}

export default function CalendarScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

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

  const nearTermCutoff = now + NEAR_TERM_DAYS * 24 * 60 * 60 * 1000;
  const buckets: { label: string; items: ActivityWithGroup[] }[] = [];
  for (const activity of upcoming) {
    const label = bucketFor(activity, nearTermCutoff);
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

  async function handleLogout() {
    const refreshToken = await secureStore.getRefreshToken();
    await endSession();
    router.replace('/(auth)/login');
    if (refreshToken) authApi.logout(refreshToken).catch(() => undefined);
  }

  function EventRow({ activity, last }: { activity: ActivityWithGroup; last: boolean }) {
    const start = new Date(activity.startAt);
    return (
      <View>
        <Row
          title={activity.title}
          subtitle={`${activity.group.name}  ·  ${formatActivityWhen(
            activity.startAt,
            activity.endAt,
            activity.allDay,
          )}`}
          leading={
            <DateBlock weekday={WEEKDAYS[start.getDay()]} day={String(start.getDate())} />
          }
          onPress={() => open(activity)}
          last={last}
        />
        <View style={styles.rowExtras}>
          {activity.status === 'draft' && <Badge status="draft" />}
          {needsReply(activity) && <Pill tone="warning" label="Reply needed" />}
          {startableToday(activity) && (
            <Button
              label={startingId === activity.id ? 'Starting…' : 'Start event'}
              onPress={() => handleStart(activity)}
              busy={startingId === activity.id}
              style={styles.startButton}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <Screen
      title="Calendar"
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['activities', 'mine'] })}
      refreshing={isFetching}
      bottomInset={80}
      headerRight={
        <Pressable onPress={handleLogout} style={styles.logout}>
          <Text style={[text.secondary, { color: color.accentText }]}>Log out</Text>
        </Pressable>
      }
    >
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
          headline="Nothing coming up"
          body="Events you're scheduled for will appear here, newest first."
        />
      )}

      {past.length > 0 && (
        <Section label={`Earlier (${past.length})`}>
          <Pressable onPress={() => setShowPast((v) => !v)} style={styles.toggle}>
            <Text style={[text.secondary, { color: color.accentText }]}>
              {showPast ? 'Hide past events' : 'Show past events'}
            </Text>
          </Pressable>
          {showPast &&
            past.map((activity, index) => (
              <Row
                key={activity.id}
                title={activity.title}
                subtitle={`${activity.group.name}  ·  ${formatActivityWhen(
                  activity.startAt,
                  activity.endAt,
                  activity.allDay,
                )}`}
                onPress={() => open(activity)}
                done
                last={index === past.length - 1}
              />
            ))}
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  logout: { paddingVertical: space.sm, paddingLeft: space.sm },
  rowExtras: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  startButton: { flexGrow: 1 },
  toggle: { paddingVertical: space.sm },
});
