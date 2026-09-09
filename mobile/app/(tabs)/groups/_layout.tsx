import { Stack } from 'expo-router';

/**
 * No native header. Every screen already names itself in its own `Screen` header, and with the
 * navigation bar on top of that each pushed screen said its name twice — once in small type at
 * the top, once in large type underneath. `ScreenHeader` carries the back arrow instead.
 */
export default function GroupsStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
