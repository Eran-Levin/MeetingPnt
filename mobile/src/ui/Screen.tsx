import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, sectionLabel, space, text } from './theme';

interface ScreenProps {
  children: React.ReactNode;
  /** Rendered above the scroll, in the screen's own padding. */
  title?: string;
  subtitle?: string;
  /** Sits on the title's baseline — a log out link, a create action. */
  headerRight?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /**
   * Extra bottom padding so the last card clears whatever floats over the screen — the live event
   * bar, the tab bar. Without it the final card is unreachable on a short list.
   */
  bottomInset?: number;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  title,
  subtitle,
  headerRight,
  onRefresh,
  refreshing = false,
  bottomInset = 0,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        { padding: space.lg, paddingBottom: space.xxl + bottomInset + insets.bottom },
        contentStyle,
      ]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      {title && (
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={[text.title, styles.headerTitle]}>{title}</Text>
            {headerRight}
          </View>
          {subtitle && <Text style={[text.secondary, styles.subtitle]}>{subtitle}</Text>}
        </View>
      )}
      {children}
    </ScrollView>
  );
}

/** Quiet uppercase label that separates one part of a screen from the next. */
export function Section({
  label,
  children,
  first = false,
}: {
  label: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <View style={first ? undefined : styles.section}>
      <Text style={[sectionLabel, styles.sectionLabel]}>{label}</Text>
      {children}
    </View>
  );
}

/**
 * An invitation, not an apology — names the space and says what would fill it, because most of
 * these screens are empty on the day someone signs up.
 */
export function Empty({ headline, body }: { headline: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={text.bodyStrong}>{headline}</Text>
      {body && <Text style={[text.secondary, styles.emptyBody]}>{body}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surfaceSunken },
  header: { marginBottom: space.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerTitle: { flex: 1 },
  subtitle: { marginTop: space.xs },
  section: { marginTop: space.xl },
  sectionLabel: { marginBottom: space.sm, marginLeft: space.xs },
  empty: {
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  emptyBody: { marginTop: space.xs, textAlign: 'center' },
});
