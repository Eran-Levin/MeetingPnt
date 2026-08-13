// Metro config for the npm-workspaces monorepo: watch the workspace root and
// resolve node_modules from both the app and the workspace root (hoisted deps).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Watching the workspace root means Metro also crawls the portal's build toolchain, which mobile
// never imports. That cost a crashed bundler: esbuild ships one prebuilt binary package per
// platform, npm leaves the other platforms' folders in the tree, and on Windows (no watchman, so
// the fallback crawler) Metro tried to watch a macOS binary directory that an `npm install` had
// just removed underneath it — `ENOENT: watch .../@esbuild/darwin-arm64`. Keeping them out of the
// crawl removes the whole class of failure, and shortens startup as a side effect.
config.resolver.blockList = [
  /[\\/]node_modules[\\/]vite[\\/].*/,
  /[\\/]node_modules[\\/]@esbuild[\\/].*/,
  /[\\/]node_modules[\\/]\.vite[\\/].*/,
];

module.exports = config;
