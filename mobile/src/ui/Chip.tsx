import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, fontSize, fontWeight, minTouchTarget, radius, space } from './theme';

/** A single-tap choice out of a small set — transport mode, days of the week. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  selected: { backgroundColor: color.accent, borderColor: color.accent },
  pressed: { opacity: 0.7 },
  label: { fontSize: fontSize.footnote, fontWeight: fontWeight.medium, color: color.text },
  labelSelected: { color: color.textInverse },
});
