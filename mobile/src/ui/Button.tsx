import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { color, fontSize, fontWeight, minTouchTarget, radius, space, toneSolid } from './theme';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Shows a spinner and blocks repeat presses — every action here hits the network. */
  busy?: boolean;
  disabled?: boolean;
  /** Sits inside a row of buttons and shares the width evenly. */
  grow?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  grow = false,
  style,
}: Props) {
  const inert = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy }}
      onPress={onPress}
      disabled={inert}
      style={({ pressed }) => [
        styles.base,
        VARIANT[variant].container,
        grow && { flex: 1 },
        pressed && styles.pressed,
        inert && styles.inert,
        style,
      ]}
    >
      <View style={styles.content}>
        {busy && <ActivityIndicator size="small" color={VARIANT[variant].label.color} />}
        <Text style={[styles.label, VARIANT[variant].label]}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** A row of buttons that share the width. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { fontSize: fontSize.body, fontWeight: fontWeight.medium },
  pressed: { opacity: 0.7 },
  inert: { opacity: 0.5 },
  row: { flexDirection: 'row', gap: space.sm },
});

const VARIANT: Record<Variant, { container: ViewStyle; label: { color: string } }> = {
  primary: {
    container: { backgroundColor: toneSolid.accent.bg },
    label: { color: toneSolid.accent.fg },
  },
  secondary: {
    container: { borderWidth: 1, borderColor: color.borderStrong, backgroundColor: color.surface },
    label: { color: color.text },
  },
  quiet: {
    container: { backgroundColor: 'transparent' },
    label: { color: color.accentText },
  },
  danger: {
    container: { backgroundColor: toneSolid.danger.bg },
    label: { color: toneSolid.danger.fg },
  },
};
