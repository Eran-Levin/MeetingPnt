import { useEffect, useState } from 'react';
import { authApi } from '../api/authApi.js';
import { isRtlLocale } from '@meetingpnt/shared';
import { useAuthStore } from '../store/authStore.js';

/** Attempts a silent refresh via the httpOnly cookie on first load, then renders children. */
export function Bootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const locale = useAuthStore((s) => s.user?.locale);

  // The page's language and direction follow the signed-in person. Logged out, it stays LTR English.
  useEffect(() => {
    document.documentElement.lang = locale ?? 'en';
    document.documentElement.dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
  }, [locale]);

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
