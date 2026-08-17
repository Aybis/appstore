const appJson = require('./app.json');

/**
 * Overlays machine-specific values onto app.json.
 *
 * `apiBaseUrl` cannot be a committed constant: it has to be the LAN IP of
 * whichever machine is running the API, because neither simulator can reach the
 * host through "localhost" (the Android emulator's localhost is the emulator
 * itself). Hard-coding one developer's IP breaks the project on every other
 * machine, so it is an env var with the committed value as a fallback.
 *
 *   MAYA_API_URL=http://192.168.1.42:3000 npx expo run:android
 *
 * Everything else still lives in app.json — this file only overrides.
 */
module.exports = () => {
  const base = appJson.expo;

  return {
    ...base,
    extra: {
      ...base.extra,
      apiBaseUrl: process.env.MAYA_API_URL ?? base.extra.apiBaseUrl,
      orgSlug: process.env.MAYA_ORG_SLUG ?? base.extra.orgSlug,
      useMockData:
        process.env.MAYA_USE_MOCK_DATA != null
          ? process.env.MAYA_USE_MOCK_DATA === 'true'
          : base.extra.useMockData,
    },
  };
};
