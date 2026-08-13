import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveEventBar } from '../../src/components/LiveEventBar';
import { useAuthStore } from '../../src/store/authStore';
import { color, fontSize, space } from '../../src/ui/theme';

export default function TabsLayout() {
  const role = useAuthStore((s) => s.user?.role);

  /**
   * Groups is planning, and planning is the leader's job — a member's read-only view of a roster
   * doesn't earn a permanent slot. With it hidden a member has one destination, so the tab bar
   * itself goes away and the calendar is simply the app.
   */
  const leads = role === 'leader' || role === 'admin';

  return (
    <Tabs
      tabBar={(props) => <DockedTabBar {...props} showTabs={leads} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.textMuted,
        tabBarLabelStyle: { fontSize: fontSize.caption },
      }}
    >
      {/* The calendar leads: a leader's day is what's happening, not a list of groups. */}
      <Tabs.Screen
        name="activities"
        options={{
          title: leads ? 'Calendar' : 'Your events',
          tabBarIcon: ({ color: c, size }) => (
            <Ionicons name="calendar-outline" color={c} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          href: leads ? undefined : null,
          tabBarIcon: ({ color: c, size }) => (
            <Ionicons name="people-outline" color={c} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

/** The running event sits above the tabs, so it survives whichever tab is selected. */
function DockedTabBar({ showTabs, ...props }: BottomTabBarProps & { showTabs: boolean }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.dock}>
      <LiveEventBar />
      {showTabs ? (
        <BottomTabBar {...props} />
      ) : (
        <View style={{ height: insets.bottom || space.sm }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.border },
});
