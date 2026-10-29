/**
 * Sentry, alongside Crashlytics rather than instead of it.
 *
 * Crashlytics stays where it is (and stays optional — see ./firebase). Sentry
 * adds what it cannot do: a JS stack mapped back to source, and a trace that
 * follows a slow screen into the API request, its database queries and its R2
 * download, because the API reports to the same Sentry organization.
 *
 * The DSN only names where events go and ships inside every build anyway, so
 * it is a constant. Development builds send nothing: a redbox on a simulator
 * is not an incident.
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN =
  'https://f5a9db76076ca329fba10d1a658eed00@o4509801270411264.ingest.us.sentry.io/4512334735474688';

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

let started = false;

export const initSentry = (): void => {
  if (started) return;
  started = true;

  Sentry.init({
    dsn: DSN,
    enabled: !__DEV__,
    environment: __DEV__ ? 'development' : 'production',
    release: `com.maya.store@${Constants.expoConfig?.version ?? 'unknown'}`,
    integrations: [navigationIntegration],
    tracesSampleRate: 1.0,
    // The API's own origin only; tokens are never put on other hosts' requests.
    tracePropagationTargets: [/^https:\/\/maya-api\.muchtar\.dev/],
    // Off: sign-in posts a password and the API answers with tokens.
    sendDefaultPii: false,
  });
};

export { Sentry };
