import type { ActivityWithGroup } from '@meetingpnt/shared';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { activitiesApi } from '../api/activitiesApi';
import { attendanceApi } from '../api/attendanceApi';
import { meetingPointsApi } from '../api/meetingPointsApi';
import { color, fontSize, fontWeight, radius, space, toneTint } from '../ui/theme';

/** How often the bar's summary catches up while an event is running. */
const REFRESH_MS = 30_000;

/**
 * The running event, pinned under the status bar and reachable from every screen.
 *
 * It isn't a tab because a leader runs perhaps three hours of live event a week — a tab would sit
 * empty the rest of the time — and because "reachable the moment they log in" has to hold wherever
 * they happen to be standing in the app, not only on the tab they last left selected. It sits at
 * the top rather than above the tab bar because it is the one thing that should catch the eye on
 * opening the app, and the bottom of a screen is where the eye goes last.
 */
export function LiveActivityBar() {
  const router = useRouter();
  const pathname = usePathname();

  const { data } = useQuery({
    queryKey: ['activities', 'mine'],
    queryFn: () => activitiesApi.listMine(),
    refetchInterval: REFRESH_MS,
  });

  const live = data?.activities.find((a) => a.status === 'in_progress');

  const { data: pointsData } = useQuery({
    queryKey: ['meetingPoints', live?.id],
    queryFn: () => meetingPointsApi.list(live!.id),
    enabled: !!live,
    refetchInterval: REFRESH_MS,
  });

  const points = pointsData?.meetingPoints ?? [];
  const currentIndex = points.findIndex((p) => p.id === live?.currentMeetingPointId);

  // The roll call is the leader's number, and only theirs — a member never sees attendance.
  const { data: rollCallData } = useQuery({
    queryKey: ['rollCall', live?.currentMeetingPointId],
    queryFn: () => attendanceApi.rollCall(live!.currentMeetingPointId!),
    enabled: !!live?.isLeader && !!live?.currentMeetingPointId,
    refetchInterval: REFRESH_MS,
  });

  if (!live) return null;

  // Already looking at it — the bar would be a link to the current screen.
  if (pathname.includes(`/activities/${live.id}`)) return null;

  return (
    <View style={styles.dock}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open the running activity, ${live.title}`}
        onPress={() => router.push(`/(tabs)/groups/${live.groupId}/activities/${live.id}`)}
        style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
      >
        <View style={styles.dot} />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {live.title}
          </Text>
          <Text style={styles.summary} numberOfLines={1}>
            {summarise(live, currentIndex, points.length, rollCallData?.entries)}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  );
}

/**
 * One line answering the question the role actually has: the leader's is "has everyone caught
 * up", the member's is "where am I going".
 */
function summarise(
  live: ActivityWithGroup,
  currentIndex: number,
  total: number,
  rollCall?: { attendance: string | null }[],
): string {
  const stop = currentIndex >= 0 && total > 0 ? `Stop ${currentIndex + 1} of ${total}` : null;

  if (live.isLeader && rollCall && rollCall.length > 0) {
    const here = rollCall.filter((e) => e.attendance === 'present').length;
    return [stop, `${here} of ${rollCall.length} here`].filter(Boolean).join('  ·  ');
  }

  return [stop, live.group.name].filter(Boolean).join('  ·  ');
}

const styles = StyleSheet.create({
  dock: { paddingHorizontal: space.sm, paddingBottom: space.sm },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 2,
    borderColor: toneTint.accent.border,
    backgroundColor: toneTint.accent.bg,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  pressed: { opacity: 0.75 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.accent },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSize.body, fontWeight: fontWeight.medium, color: color.accentText },
  summary: { fontSize: fontSize.caption, color: color.accentText, opacity: 0.85 },
  chevron: { fontSize: 22, color: color.accentText },
});
