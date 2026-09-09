import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveActivityBar } from '../../src/components/LiveActivityBar';
import { useAuthStore } from '../../src/store/authStore';
import { TopInsetHandledProvider } from '../../src/ui';
import { color, fontSize, space } from '../../src/ui/theme';

export default function TabsLayout() {
  const role = useAuthStore((s) => s.user?.role);
  const insets = useSafeAreaInsets();

  /**
   * Groups is planning, and planning is the leader's job — a member's read-only view of a roster
   * doesn't earn a permanent slot. With it hidden a member has one destination, so the tab bar
   * itself goes away and the calendar is simply the app.
   */
  const leads = role === 'leader' || role === 'admin';

  return (
    <View style={styles.shell}>
      {/*
       * The running activity sits at the top, directly under the status bar and above whatever
       * screen is showing. It's the first thing that should catch the eye on opening the app, and
       * docked at the bottom it read as a footer — the place the eye goes last.
       *
       * This strip owns the top safe area for everything inside the tabs, which is what the
       * provider tells the screens below. It's always rendered, even with nothing running, so the
       * inset doesn't jump when an activity starts; empty, it's just the status bar's background.
       */}
      <View style={[styles.topDock, { paddingTop: insets.top }]}>
        <LiveActivityBar />
      </View>

      <TopInsetHandledProvider>
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
              title: leads ? 'Calendar' : 'Your activities',
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
      </TopInsetHandledProvider>
    </View>
  );
}

/** A member has no tabs, so all this leaves is the bottom safe area to sit above. */
function DockedTabBar({ showTabs, ...props }: BottomTabBarProps & { showTabs: boolean }) {
  const insets = useSafeAreaInsets();

  if (!showTabs) {
    return <View style={{ height: insets.bottom || space.sm }} />;
  }

  return (
    <View style={styles.dock}>
      <BottomTabBar {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: color.surfaceSunken },
  topDock: { backgroundColor: color.surfaceSunken },
  dock: { backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.border },
});
