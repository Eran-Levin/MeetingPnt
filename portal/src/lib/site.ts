/**
 * One build, two front doors. `www.` is the marketing site; everything else — `app.`, a branch
 * preview, localhost — is the application. The Worker only serves static files, so which one this
 * is gets decided here, in the browser, from the host name.
 *
 * `VITE_APP_URL` / `VITE_MARKETING_URL` are the two origins (no trailing slash). Unset — local
 * development, a `workers.dev` preview — everything stays on the current origin and the landing
 * page is simply what a signed-out visitor sees at `/`.
 */
const trim = (url?: string) => (url ? url.replace(/\/+$/, '') : '');

// A branch or commit preview lives on a *.workers.dev host and must stay there: the variables are
// baked into every build, so without this a preview would bounce to the live site.
const isPreview = typeof location !== 'undefined' && location.hostname.endsWith('.workers.dev');

const APP_URL = isPreview ? '' : trim(import.meta.env.VITE_APP_URL as string | undefined);
const MARKETING_URL = isPreview ? '' : trim(import.meta.env.VITE_MARKETING_URL as string | undefined);

export const isMarketingHost =
  typeof location !== 'undefined' && location.hostname.startsWith('www.');

/** Where a sign-in or sign-up link should go: the app, wherever it lives. */
export function appUrl(path: string): string {
  return `${APP_URL}${path}`;
}

/** The public site, or null when there isn't a separate one to send people to. */
export function marketingUrl(): string | null {
  // A marketing URL on this very origin (a mistyped variable) would redirect to itself forever.
  if (typeof location !== 'undefined' && MARKETING_URL.startsWith(location.origin)) return null;
  return MARKETING_URL || null;
}
