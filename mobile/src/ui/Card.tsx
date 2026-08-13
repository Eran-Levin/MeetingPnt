import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { color, radius, space, toneTint } from './theme';

interface Props {
  children: React.ReactNode;
  /**
   * Picks the card out of the stack. `accent` is reserved for where the group is right now — the
   * live event, the current meeting point — so that emphasis keeps meaning something.
   */
  accent?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, accent = false, onPress, style }: Props) {
  const content = [styles.base, accent && styles.accent, style];

  if (!onPress) return <View style={content}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [...content, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  accent: {
    borderWidth: 2,
    borderColor: toneTint.accent.border,
    backgroundColor: toneTint.accent.bg,
  },
  pressed: { opacity: 0.75 },
});
