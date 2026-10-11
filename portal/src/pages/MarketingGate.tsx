import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { appUrl } from '../lib/site.js';
import { LandingPage } from './LandingPage.js';

/**
 * The whole of `www.` — the landing page, except for someone who is already signed in, who has
 * no use for a sales pitch and goes straight to their groups. Bootstrap has already tried the
 * refresh cookie by the time this renders, so `authenticated` is the answer, not a guess.
 */
export function MarketingGate() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === 'authenticated') {
      window.location.replace(appUrl('/'));
    }
  }, [status]);

  return status === 'authenticated' ? null : <LandingPage />;
}
