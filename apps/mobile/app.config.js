const fs = require('node:fs');
const path = require('node:path');

const appJson = require('./app.json');

/**
 * Where Firebase expects each platform's project credentials. Both are
 * downloaded from the Firebase console and are NOT committed — they identify
 * one specific Firebase project, so a checked-in copy would point every clone
 * of this repo at whoever generated it.
 */
const ANDROID_CREDENTIALS = './google-services.json';
const IOS_CREDENTIALS = './GoogleService-Info.plist';

const has = (relative) => fs.existsSync(path.join(__dirname, relative));

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

  /*
   * Firebase is wired only when its credentials are actually present.
   *
   * This is not defensiveness, it is a hard build constraint: the Google
   * Services gradle plugin FAILS the Android build outright when
   * google-services.json is missing. Declaring the Firebase plugins
   * unconditionally would mean nobody could build this app at all until they
   * had a Firebase project — including people who never wanted one.
   *
   * So the app builds and runs without it, with every telemetry call falling
   * through to a no-op (see src/telemetry). Drop the file in, rebuild, and the
   * same call sites start reporting. No code changes on either side of that.
   */
  const androidReady = has(ANDROID_CREDENTIALS);
  const iosReady = has(IOS_CREDENTIALS);
  const firebaseReady = androidReady || iosReady;

  return {
    ...base,
    plugins: firebaseReady
      ? [
          ...base.plugins,
          '@react-native-firebase/app',
          '@react-native-firebase/crashlytics',
          '@react-native-firebase/analytics',
        ]
      : base.plugins,
    android: {
      ...base.android,
      ...(androidReady && { googleServicesFile: ANDROID_CREDENTIALS }),
    },
    ios: {
      ...base.ios,
      ...(iosReady && { googleServicesFile: IOS_CREDENTIALS }),
    },
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
