import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { Avatar } from './Avatar';
import { color, minTouchTarget, sectionLabel, space, text } from './theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Sits between the title and the account button — a chat link, a create action. */
  right?: React.ReactNode;
  /** Defaults to whether there is anywhere to go back to. */
  back?: boolean;
  /** Off on the account screen itself, which is where the button leads. */
  account?: boolean;
}

/**
 * The only header in the app. The native stack header is switched off everywhere: with both, every
 * pushed screen named itself twice — once in the navigation bar, once in the page.
 */
export function ScreenHeader({ title, subtitle, right, back, account = true }: ScreenHeaderProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const showBack = back ?? router.canGoBack();

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {showBack && (
          <Pressable
            onPress={() => router.back()}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={space.sm}
          >
            <Ionicons name="chevron-back" size={26} color={color.accentText} />
          </Pressable>
        )}
        <Text style={[text.title, styles.headerTitle]} numberOfLines={2}>
          {title}
        </Text>
        {right}
        {account && user && (
          <Pressable
            onPress={() => router.push('/account')}
            style={styles.account}
            accessibilityRole="button"
            accessibilityLabel={`Account — signed in as ${user.name}`}
          >
            <Avatar name={user.name} uri={user.avatarUrl} size={36} />
          </Pressable>
        )}
      </View>
      {subtitle && <Text style={[text.secondary, styles.subtitle]}>{subtitle}</Text>}
    </View>
  );
}

interface ScreenProps extends Omit<ScreenHeaderProps, 'title' | 'right'> {
  children: React.ReactNode;
  /** Rendered above the scroll, in the screen's own padding. */
  title?: string;
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
  back,
  account,
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
        {
          padding: space.lg,
          // The status bar and the notch sit over this scroll — without clearing them the title
          // and the account button land under the hardware and can't be read or tapped.
          paddingTop: insets.top + space.lg,
          paddingBottom: space.xxl + bottomInset + insets.bottom,
        },
        contentStyle,
      ]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      {title && (
        <ScreenHeader
          title={title}
          subtitle={subtitle}
          right={headerRight}
          back={back}
          account={account}
        />
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerTitle: { flex: 1 },
  back: { marginLeft: -space.sm, justifyContent: 'center' },
  /** The account button carries a face, so it's already past 44 — the padding keeps it reachable
   * without pushing the title off the row. */
  account: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
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
