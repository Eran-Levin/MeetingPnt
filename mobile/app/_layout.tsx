import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import {
  registerBackgroundNotificationTask,
  registerNotificationResponseHandler,
  setupNotificationCategories,
} from '../src/services/pingHandler';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    setupNotificationCategories().catch(() => undefined);
    registerBackgroundNotificationTask().catch(() => undefined);
    const subscription = registerNotificationResponseHandler();
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
