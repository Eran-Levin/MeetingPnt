// Wakes the free-tier API servers before a test session.
//
// Render spins a free service down after 15 idle minutes and the first request then takes 30-60 s.
// Pinging on a schedule would avoid that, but the free plan is one pool of 750 hours a month shared
// by every service, and one service kept awake around the clock uses ~720 of them -- leaving none
// for staging, and when the pool runs out Render suspends *all* of them, production included.
// So wake on demand instead:  npm run wake            (both)
//                             npm run wake -- <url>…  (specific servers)
const DEFAULTS = ['https://api.meetingpnt.com', 'https://meetingpnt-api-staging.onrender.com'];
const urls = process.argv.length > 2 ? process.argv.slice(2) : DEFAULTS;

async function wake(base) {
  const started = Date.now();
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/health`, {
      signal: AbortSignal.timeout(120_000),
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    return `${res.ok ? 'up   ' : `HTTP ${res.status}`}  ${seconds.padStart(5)} s  ${base}`;
  } catch (err) {
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    return `DOWN  ${seconds.padStart(5)} s  ${base}  (${err.cause?.code ?? err.name})`;
  }
}

console.log('Waking (a sleeping server takes up to a minute)…');
for (const line of await Promise.all(urls.map(wake))) console.log(line);
