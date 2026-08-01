import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      {/* Events lead: a leader's day is a timeline of what's happening, not a list of groups. */}
      <Tabs.Screen name="activities" options={{ title: 'Events', headerShown: false }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups', headerShown: false }} />
    </Tabs>
  );
}
