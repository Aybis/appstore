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

// Without this, Metro walks up past nodeModulesPaths and can pick up a second
// copy of react from another workspace package.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
