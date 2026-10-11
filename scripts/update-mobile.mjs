// Ships the phone app's JavaScript to every phone running the `preview` build, with no new APK.
//   npm run update:mobile -- "what changed"
//
// Phones pick it up the next time the app is opened (a second open applies it). Only JavaScript and
// text reach phones this way. A change that adds a native module, a config plugin or native settings
// needs a new build instead — see "Phone updates without a build" in DEPLOYMENT.md.
import { execSync, spawnSync } from 'node:child_process';

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

// Shipping broken JavaScript to phones is the one way this goes wrong, so check it first.
console.log('Typechecking the phone app…');
if (spawnSync('npm', ['run', 'typecheck', '-w', 'mobile'], { stdio: 'inherit', shell: true }).status !== 0) {
  console.error('Typecheck failed, so nothing was published.');
  process.exit(1);
}

console.log(`Publishing to phones on the "preview" build: ${message}`);
const result = spawnSync(
  'npx',
  ['--yes', 'eas-cli@latest', 'update', '--branch', 'preview', '--platform', 'android', '--message', message, '--non-interactive'],
  { cwd: 'mobile', stdio: 'inherit', shell: true },
);
process.exit(result.status ?? 1);
