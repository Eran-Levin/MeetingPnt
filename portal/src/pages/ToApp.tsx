import { useEffect } from 'react';
import { appUrl } from '../lib/site.js';

/** On `www.`, any path that belongs to the application — a bookmarked login, an old link. */
export function ToApp() {
  useEffect(() => {
    const target = appUrl(location.pathname + location.search);
    // Without VITE_APP_URL the target is this very page; redirecting would loop forever.
    if (new URL(target, location.href).origin !== location.origin) {
      window.location.replace(target);
    }
  }, []);
  return null;
}
