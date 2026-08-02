import type { ActivityWithGroup } from '@meetingpnt/shared';
import { formatActivityWhen } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { activitiesApi } from '../../../src/api/activitiesApi';
import { authApi } from '../../../src/api/authApi';
import { secureStore } from '../../../src/services/secureStore';
import { endSession } from '../../../src/services/session';

/** "in 3 hours", "in 25 minutes", "started 10 minutes ago" — the leader thinks in time-to-go. */
function relativeToNow(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const absMin = Math.round(Math.abs(diffMs) / 60000);
  const past = diffMs < 0;

  let phrase: string;
  if (absMin < 1) phrase = 'now';
  else if (absMin < 60) phrase = `${absMin} minute${absMin === 1 ? '' : 's'}`;
  else if (absMin < 60 * 24) {
    const hours = Math.round(absMin / 60);
    phrase = `${hours} hour${hours === 1 ? '' : 's'}`;
  } else {
    const days = Math.round(absMin / (60 * 24));
    phrase = `${days} day${days === 1 ? '' : 's'}`;
  }

  if (phrase === 'now') return 'now';
  return past ? `${phrase} ago` : `in ${phrase}`;
}

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

/** How far ahead "Next up" reaches, and the fewest events it will show regardless. */
const NEAR_TERM_DAYS = 7;
const MIN_NEXT_UP = 3;

export default function ActivitiesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [showLater, setShowLater] = useState(false);

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
  const live = activities.filter((a) => a.status === 'in_progress');
  // Still to come means the clock agrees, not just the status. A published event nobody ever
  // started or ended keeps that status forever, and without the date check it would sit at the
  // top of "Next up" months after it happened.
  const hasEnded = (a: ActivityWithGroup) => new Date(a.endAt).getTime() < now;
  const upcoming = activities.filter(
    (a) => (a.status === 'published' || a.status === 'draft') && !hasEnded(a),
  );
  const past = activities.filter((a) => a.status === 'completed' || hasEnded(a));

  /**
   * This screen answers "what's happening", so it can't be everything the leader has ever
   * scheduled — a twice-weekly yoga term is ten identical cards, and a tour guide with two
   * departures booked is looking at November from August. Near-term leads; the rest folds away
   * but stays reachable, because hiding a scheduled event outright would be worse than a long
   * list. The floor of three keeps the section useful for a leader whose next event is a month
   * out, which is exactly the monthly photo walk.
   */
  const nearTermCutoff = now + NEAR_TERM_DAYS * 24 * 60 * 60 * 1000;
  const withinWindow = upcoming.filter((a) => new Date(a.startAt).getTime() <= nearTermCutoff);
  const nextUp = withinWindow.length >= MIN_NEXT_UP ? withinWindow : upcoming.slice(0, MIN_NEXT_UP);
  const later = upcoming.slice(nextUp.length);

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

  function Card({ activity, live: isLive }: { activity: ActivityWithGroup; live?: boolean }) {
    return (
      <TouchableOpacity
        style={[styles.card, isLive && styles.cardLive]}
        onPress={() => open(activity)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{activity.title}</Text>
          {isLive && <Text style={styles.liveTag}>LIVE</Text>}
        </View>
        <Text style={styles.muted}>{activity.group.name}</Text>
        <Text style={styles.when}>
          {formatActivityWhen(activity.startAt, activity.endAt, activity.allDay)}
          {!activity.allDay && ` · starts ${relativeToNow(activity.startAt)}`}
        </Text>

        {activity.isLeader && activity.status === 'published' && (
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => handleStart(activity)}
            disabled={startingId === activity.id}
          >
            <Text style={styles.startButtonText}>
              {startingId === activity.id ? 'Starting…' : 'Start event'}
            </Text>
          </TouchableOpacity>
        )}
        {activity.status === 'draft' && <Text style={styles.draftTag}>Draft — not published yet</Text>}
        {needsReply(activity) && <Text style={styles.replyTag}>Tap to reply</Text>}
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['activities', 'mine'] })}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Your events</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      {live.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Happening now</Text>
          {live.map((a) => (
            <Card key={a.id} activity={a} live />
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Next up</Text>
      {nextUp.map((a) => (
        <Card key={a.id} activity={a} />
      ))}
      {nextUp.length === 0 && <Text style={styles.muted}>Nothing scheduled.</Text>}

      {later.length > 0 && (
        <>
          <TouchableOpacity onPress={() => setShowLater((v) => !v)}>
            <Text style={styles.sectionTitle}>
              Later ({later.length}) {showLater ? '▾' : '▸'}
            </Text>
          </TouchableOpacity>
          {showLater &&
            later.map((a) => (
              <TouchableOpacity key={a.id} style={styles.laterRow} onPress={() => open(a)}>
                <Text style={styles.laterTitle} numberOfLines={1}>
                  {a.title}
                </Text>
                <Text style={styles.muted}>
                  {formatActivityWhen(a.startAt, a.endAt, a.allDay)}
                  {a.status === 'draft' ? '  ·  draft' : ''}
                </Text>
              </TouchableOpacity>
            ))}
        </>
      )}

      {past.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Earlier</Text>
          {past.map((a) => (
            <Card key={a.id} activity={a} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
  logout: { color: '#2563eb' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', marginTop: 24, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, marginBottom: 10 },
  cardLive: { borderColor: '#2563eb', borderWidth: 2, backgroundColor: '#eff6ff' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  liveTag: { color: '#2563eb', fontWeight: '700', fontSize: 12 },
  when: { marginTop: 6, color: '#334155' },
  muted: { color: '#888', marginTop: 2 },
  laterRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  laterTitle: { fontSize: 15 },
  draftTag: { marginTop: 8, color: '#b45309', fontSize: 12 },
  replyTag: { marginTop: 8, color: '#b45309', fontWeight: '600', fontSize: 12 },
  startButton: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  startButtonText: { color: 'white', fontWeight: '600' },
});
