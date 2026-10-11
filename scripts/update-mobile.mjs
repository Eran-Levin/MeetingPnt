// Ships the phone app's JavaScript to every phone running the `preview` build, with no new APK.
//   npm run update:mobile -- "what changed"
//
// Phones pick it up the next time the app is opened (a second open applies it). Only JavaScript and
// text reach phones this way. A change that adds a native module, a config plugin or native settings
// needs a new build instead — see "Phone updates without a build" in DEPLOYMENT.md.
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const message = process.argv.slice(2).join(' ').trim() || 'update';
const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

// Phones must match what is deployed: publish only from an up-to-date, clean master.
const branch = sh('git branch --show-current');
if (branch !== 'master') {
  console.error(`Refusing to publish from "${branch}". Merge to master first, then run this from master.`);
  process.exit(1);
}
if (sh('git status --porcelain')) {
  console.error('Refusing to publish with uncommitted changes. Commit or discard them first.');
  process.exit(1);
}
sh('git fetch -q origin');
if (sh('git rev-list --count HEAD..origin/master') !== '0') {
  console.error('Your master is behind origin/master. Run `git pull` first.');
  process.exit(1);
}

// An update is JavaScript compiled on THIS machine, and `EXPO_PUBLIC_*` values are baked into it at
// that moment — from the shell, or failing that from mobile/.env. The `preview` build's server
// address lives in eas.json and only applies to EAS builds, not to `eas update`. Left alone, an
// update silently carries whatever mobile/.env says: the local `http://192.168…` address, which a
// release build refuses to call, so every login failed instantly. So the address is taken from the
// preview profile, passed in explicitly, and the result is checked before anything is published.
const apiUrl = JSON.parse(readFileSync('mobile/eas.json', 'utf8')).build.preview.env
  .EXPO_PUBLIC_API_BASE_URL;
if (!apiUrl || !apiUrl.startsWith('https://')) {
  console.error('mobile/eas.json has no https EXPO_PUBLIC_API_BASE_URL for the preview profile.');
  process.exit(1);
}
const env = { ...process.env, EXPO_PUBLIC_API_BASE_URL: apiUrl };

// Shipping broken JavaScript to phones is the one way this goes wrong, so check it first.
console.log('Typechecking the phone app…');
if (spawnSync('npm', ['run', 'typecheck', '-w', 'mobile'], { stdio: 'inherit', shell: true }).status !== 0) {
  console.error('Typecheck failed, so nothing was published.');
  process.exit(1);
}

console.log(`Checking the bundle points at ${apiUrl}…`);
const outDir = mkdtempSync(join(tmpdir(), 'mpnt-update-'));
try {
  const exported = spawnSync(
    `npx expo export --clear --platform android --output-dir "${outDir}"`,
    { cwd: 'mobile', env, stdio: 'ignore', shell: true },
  );
  const jsDir = join(outDir, '_expo', 'static', 'js', 'android');
  const bundle = exported.status === 0 && existsSync(jsDir) ? readdirSync(jsDir).find((f) => f.endsWith('.hbc')) : null;
  if (!bundle) {
    console.error('Could not build the bundle to check it, so nothing was published.');
    process.exit(1);
  }
  const text = readFileSync(join(jsDir, bundle), 'latin1');

  // Whatever mobile/.env holds must not have leaked in.
  const local = existsSync('mobile/.env')
    ? /^EXPO_PUBLIC_API_BASE_URL=(.+)$/m.exec(readFileSync('mobile/.env', 'utf8'))?.[1]?.trim()
    : undefined;
  if (!text.includes(apiUrl)) {
    console.error(`The bundle does not contain ${apiUrl}, so nothing was published.`);
    process.exit(1);
  }
  if (local && local !== apiUrl && text.includes(local)) {
    console.error(`The bundle contains the local address ${local} from mobile/.env, so nothing was published.`);
    process.exit(1);
  }
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log(`Publishing to phones on the "preview" build: ${message}`);
// One command string, with the message quoted. Passing an argument array together with `shell: true`
// joins it with plain spaces on Windows, so a message with spaces arrived as separate arguments and
// EAS rejected it. (Messages with a double quote in them are not supported.)
const quoted = JSON.stringify(message.replace(/"/g, "'"));
const result = spawnSync(
  `npx --yes eas-cli@latest update --branch preview --platform android --clear-cache --message ${quoted} --non-interactive`,
  { cwd: 'mobile', env, stdio: 'inherit', shell: true },
);
process.exit(result.status ?? 1);
