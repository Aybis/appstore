// Metro config for this app living inside the pnpm monorepo.
// Metro must watch the workspace root so changes in packages/shared trigger
// a rebuild, and must resolve modules from both the app and the root store.
const path = require('path');

// Sentry's wrapper around Expo's defaults: adds the debug ids that tie each
// bundle to its uploaded source map.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getSentryExpoConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

/*
 * Hierarchical lookup stays ON: a package must find the dependency copy nested
 * under its own node_modules, as Node would. Turning it off (as this file used
 * to) makes Metro resolve everything from the root, and the root holds whatever
 * version the API or console hoisted there — @sentry/react-native 8 then got
 * @sentry/core 11 instead of its own 10.x, and crashed at startup with
 * "undefined is not a constructor" in BrowserClient.
 *
 * What the old setting was really guarding against — a second React from
 * another workspace package — is pinned explicitly instead: `react` and
 * `react-native` always resolve from this app, whoever imports them.
 */
/*
 * @sentry/core is pinned too, to @sentry/react-native's copy. pnpm nests one
 * under @sentry/browser as well (the root holds the server SDK's newer major),
 * and two module instances of the SDK core in one app break its instanceof
 * checks and ship it twice.
 */
const sentryRoot = path.dirname(
  require.resolve('@sentry/react-native/package.json', { paths: [projectRoot] }),
);
const PINNED_FROM = {
  react: projectRoot,
  'react-native': projectRoot,
  '@sentry/core': sentryRoot,
};
const packageOf = (moduleName) => {
  const parts = moduleName.split('/');
  return moduleName.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

const resolveDefault = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const from = PINNED_FROM[packageOf(moduleName)];
  const pinned = from
    ? { ...context, originModulePath: path.join(from, 'package.json') }
    : context;
  return resolveDefault
    ? resolveDefault(pinned, moduleName, platform)
    : context.resolveRequest(pinned, moduleName, platform);
};

module.exports = config;
