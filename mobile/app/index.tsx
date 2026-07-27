import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { authApi } from '../src/api/authApi';
import { secureStore } from '../src/services/secureStore';
import { establishSession, endSession } from '../src/services/session';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  const [ready, setReady] = useState(false);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    (async () => {
      const storedRefreshToken = await secureStore.getRefreshToken();
      if (!storedRefreshToken) {
        await endSession();
        setReady(true);
        return;
      }
      try {
        const data = await authApi.refresh(storedRefreshToken);
        await establishSession(data);
      } catch {
        await endSession();
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={status === 'authenticated' ? '/(tabs)/groups' : '/(auth)/login'} />;
}
