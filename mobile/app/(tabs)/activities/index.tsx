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

export default function ActivitiesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [startingId, setStartingId] = useState<string | null>(null);

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
  const upcoming = activities.filter(
    (a) => a.status === 'published' || (a.status === 'draft' && new Date(a.endAt).getTime() >= now),
  );
  const finished = activities.filter((a) => a.status === 'completed');

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
      {upcoming.map((a) => (
        <Card key={a.id} activity={a} />
      ))}
      {upcoming.length === 0 && <Text style={styles.muted}>Nothing scheduled.</Text>}

      {finished.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recently finished</Text>
          {finished.map((a) => (
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
  draftTag: { marginTop: 8, color: '#b45309', fontSize: 12 },
  replyTag: { marginTop: 8, color: '#b45309', fontWeight: '600', fontSize: 12 },
  startButton: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  startButtonText: { color: 'white', fontWeight: '600' },
});
