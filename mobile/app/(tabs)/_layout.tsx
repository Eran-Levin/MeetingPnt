import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="groups" options={{ title: 'Groups', headerShown: false }} />
    </Tabs>
  );
}
