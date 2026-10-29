/**
 * Sentry, alongside Crashlytics rather than instead of it.
 *
 * Crashlytics stays where it is (and stays optional — see ./firebase). Sentry
 * adds what it cannot do: a JS stack mapped back to source, and a trace that
 * follows a slow screen into the API request, its database queries and its R2
 * download, because the API reports to the same Sentry organization.
 *
 * The DSN only names where events go and ships inside every build anyway, so
 * the default is a constant; MAYA_SENTRY_DSN in the root .env overrides it at
 * build time.
 *
 * Development builds send nothing by default: a redbox on a simulator is not
 * an incident. Set MAYA_SENTRY_DEV=true in the root .env (and rebuild) to send
 * them anyway, tagged environment=development, when checking the setup.
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN =
  (Constants.expoConfig?.extra?.sentryDsn as string | undefined) ||
  'https://f5a9db76076ca329fba10d1a658eed00@o4509801270411264.ingest.us.sentry.io/4512334735474688';

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

const reportInDev = Constants.expoConfig?.extra?.sentryInDev === true;

let started = false;

export const initSentry = (): void => {
  if (started) return;
  started = true;

  Sentry.init({
    dsn: DSN,
    enabled: !__DEV__ || reportInDev,
    environment: __DEV__ ? 'development' : 'production',
    /*
     * No `release` here, deliberately. The native SDK sets it from the build
     * itself — com.maya.store@0.0.2+<versionCode> — along with `dist`, and
     * that is exactly the name sentry.gradle uploads this build's source maps
     * under. A hand-written release without the build number split every
     * build of one version into one release and could not say which build a
     * crash came from.
     */
    integrations: [navigationIntegration],
    tracesSampleRate: 1.0,
    // The API's own origin only; tokens are never put on other hosts' requests.
    tracePropagationTargets: [/^https:\/\/maya-api\.muchtar\.dev/],
    // Off: sign-in posts a password and the API answers with tokens.
    sendDefaultPii: false,
  });
};

export { Sentry };
