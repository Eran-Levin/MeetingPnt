import { useEffect, useState } from 'react';
import { authApi } from '../api/authApi.js';
import { useAuthStore } from '../store/authStore.js';

/** Attempts a silent refresh via the httpOnly cookie on first load, then renders children. */
export function Bootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    authApi
      .refresh()
      .then((data) => setSession(data.user, data.accessToken))
      .catch(() => clearSession())
      .finally(() => setReady(true));
  }, [setSession, clearSession]);

  if (!ready) {
    return <p style={{ padding: 24 }}>Loading…</p>;
  }

  return <>{children}</>;
}
