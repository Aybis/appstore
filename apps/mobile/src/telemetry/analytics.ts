/**
 * Analytics, as plain functions you can call from anywhere.
 *
 * Deliberately NOT a hook and NOT a context. Most of the interesting moments to
 * record — an install failing, a token refresh, a request timing out — happen
 * in plain modules that have no React tree around them, and a hook-shaped API
 * would push those call sites into contortions or, more likely, into silence.
 *
 * EVERY FUNCTION HERE SWALLOWS ITS ERRORS, on the same principle the device
 * telemetry follows: analytics that breaks a sign-in is worse than analytics
 * that goes missing. Nothing in this file is allowed to be the reason a user
 * cannot install an app.
 */

import { firebase } from './firebase';

/** Firebase rejects event names that are not snake_case within 40 chars. */
const MAX_NAME = 40;

const normalise = (name: string): string =>
  name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, MAX_NAME);

export type EventParams = Record<string, string | number | boolean | undefined>;

/**
 * Records one event.
 *
 *     track('app_install_started', { slug, track: 'production' })
 */
export const track = (name: string, params?: EventParams): void => {
  const fb = firebase();
  if (!fb) return;

  try {
    const clean: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(params ?? {})) {
      // undefined is the normal shape of "we did not learn this one" at these
      // call sites; forwarding it makes Firebase reject the whole event.
      if (value !== undefined) clean[normalise(key)] = value;
    }
    fb.analytics.logEvent(fb.analyticsInstance as never, normalise(name) as never, clean as never);
  } catch {
    /* see the file header */
  }
};

/** Records a screen view. Wired automatically — see useScreenTracking. */
export const trackScreen = (name: string): void => {
  const fb = firebase();
  if (!fb) return;

  try {
    fb.analytics.logScreenView(fb.analyticsInstance as never, {
      screen_name: name,
      screen_class: name,
    } as never);
  } catch {
    /* see the file header */
  }
};

/**
 * Ties everything after this call to one signed-in user.
 *
 * The id is the API's user id, NOT an email address. Firebase retains user
 * properties well beyond a session, and putting an address in one turns an
 * analytics console into a copy of the staff directory.
 */
export const identify = (userId: string, properties?: Record<string, string>): void => {
  const fb = firebase();
  if (!fb) return;

  try {
    fb.analytics.setUserId(fb.analyticsInstance as never, userId as never);
    fb.crashlytics.setUserId(fb.crashlyticsInstance as never, userId as never);
    if (properties) {
      fb.analytics.setUserProperties(fb.analyticsInstance as never, properties as never);
    }
  } catch {
    /* see the file header */
  }
};

/** Clears the identity on sign-out so the next user is not attributed here. */
export const resetIdentity = (): void => {
  const fb = firebase();
  if (!fb) return;

  try {
    fb.analytics.setUserId(fb.analyticsInstance as never, null as never);
    fb.crashlytics.setUserId(fb.crashlyticsInstance as never, '' as never);
  } catch {
    /* see the file header */
  }
};
