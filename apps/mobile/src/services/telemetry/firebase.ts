/**
 * Resolves the Firebase SDKs, or decides once that they are not available.
 *
 * This app is built to run in four states, and only the last one reports:
 *
 *   1. the packages are not installed at all
 *   2. installed, but the native module was never linked
 *   3. linked, but no google-services.json, so no default app was created
 *   4. fully configured
 *
 * State 3 is the DEFAULT for this repo and the reason this file exists. The
 * credentials identify one specific Firebase project and are not committed, so
 * a fresh clone builds and runs with Firebase inert. Every call below still
 * works — it just goes nowhere. Drop the credentials in, rebuild, and the same
 * call sites start reporting without a line of code changing.
 *
 * The resolution is attempted ONCE and cached either way. A `require` that
 * throws on every screen view would cost more than the telemetry is worth.
 */

type FirebaseModules = {
  analytics: Record<string, (...args: never[]) => unknown>;
  crashlytics: Record<string, (...args: never[]) => unknown>;
  analyticsInstance: unknown;
  crashlyticsInstance: unknown;
};

let resolved: FirebaseModules | null = null;
let attempted = false;

const attempt = (): FirebaseModules | null => {
  if (attempted) return resolved;
  attempted = true;

  try {
    /*
     * require rather than import, because the whole point is to survive these
     * modules being absent. A static import is hoisted and would take the app
     * down at startup in states 1 and 2 rather than degrading.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const app = require('@react-native-firebase/app');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const analytics = require('@react-native-firebase/analytics');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crashlytics = require('@react-native-firebase/crashlytics');

    // The check that separates state 3 from state 4. Without credentials the
    // native side creates no default app, and getApp() throws.
    app.getApp();

    resolved = {
      analytics,
      crashlytics,
      analyticsInstance: analytics.getAnalytics(),
      crashlyticsInstance: crashlytics.getCrashlytics(),
    };
  } catch {
    // Deliberately silent. Running without Firebase is a supported
    // configuration, not a fault, and a warning on every cold start would
    // train people to ignore the console.
    resolved = null;
  }

  return resolved;
};

export const firebase = (): FirebaseModules | null => attempt();

/** True once Firebase is actually reporting. Exposed for the profile screen. */
export const isTelemetryActive = (): boolean => attempt() !== null;
