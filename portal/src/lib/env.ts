/**
 * Which backend this copy of the portal talks to.
 *
 * Production builds use `VITE_API_BASE_URL`. A Cloudflare *preview* deployment — any branch or
 * commit preview, which lives on a `*.workers.dev` host — uses `VITE_STAGING_API_BASE_URL` when
 * that is set, so a branch under test can never write to the production database. Cloudflare gives
 * every build the same variables, so the choice is made here, at runtime, from the host name.
 *
 * The real site is served from its own domain, so it is never mistaken for a preview. (Its plain
 * `workers.dev` address is treated as a preview once the staging variable exists.)
 */
const previewHost = typeof location !== 'undefined' && location.hostname.endsWith('.workers.dev');
const staging = import.meta.env.VITE_STAGING_API_BASE_URL as string | undefined;

export const API_BASE_URL: string =
  previewHost && staging ? staging : (import.meta.env.VITE_API_BASE_URL as string);

/** The socket lives on the API server; staging has no separate socket address. */
export const SOCKET_URL: string =
  previewHost && staging ? staging : (import.meta.env.VITE_SOCKET_URL as string);
