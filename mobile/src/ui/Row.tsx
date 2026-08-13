import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, minTouchTarget, radius, space, text } from './theme';

interface RowProps {
  title: string;
  subtitle?: string;
  /** Fixed-width leading slot — a date block, a numbered route marker, an avatar. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Picked out because it's where the group is now. */
  active?: boolean;
  /** Behind us — a visited stop, a past event. Reads as done without disappearing. */
  done?: boolean;
  last?: boolean;
}

export function Row({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  active = false,
  done = false,
  last = false,
}: RowProps) {
  const body = (
    <>
      {leading}
      <View style={styles.text}>
        <Text
          style={[text.body, active && text.bodyStrong, done && styles.doneText]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={[text.secondary, done && styles.doneText]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
    </>
  );

  const style = [
    styles.row,
    !last && !active && styles.divided,
    active && styles.active,
    done && styles.done,
  ];

  if (!onPress) return <View style={style}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

/** The numbered circle on a route stop. Filled when it's the stop the group is heading to. */
export function StepMarker({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.marker, active && styles.markerActive]}>
      <Text style={[styles.markerText, active && styles.markerTextActive]}>{label}</Text>
    </View>
  );
}

/** The day block on a calendar row — "THU / 14". Scannable without reading the event. */
export function DateBlock({ weekday, day }: { weekday: string; day: string }) {
  return (
    <View style={styles.date}>
      <Text style={styles.dateWeekday}>{weekday}</Text>
      <Text style={styles.dateDay}>{day}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  divided: { borderBottomWidth: 1, borderBottomColor: color.border },
  active: {
    backgroundColor: color.accentSurface,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
  },
  done: { opacity: 0.55 },
  doneText: { color: color.textSecondary },
  pressed: { opacity: 0.7 },
  text: { flex: 1, minWidth: 0 },
  marker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerActive: { backgroundColor: color.accent, borderColor: color.accent },
  markerText: { fontSize: 12, color: color.textSecondary },
  markerTextActive: { color: color.textInverse, fontWeight: '600' },
  date: { width: 38, alignItems: 'center' },
  dateWeekday: { fontSize: 11, color: color.textMuted, letterSpacing: 0.4 },
  dateDay: { fontSize: 18, fontWeight: '600', color: color.text },
});
