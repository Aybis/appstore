/**
 * Crash and error reporting, as plain functions callable from anywhere.
 *
 * Two kinds of thing arrive here:
 *
 *   - a NATIVE crash, which Crashlytics catches on its own with no help from
 *     this file, and reports on the next launch
 *   - a JS error, which does not crash the process and which Crashlytics never
 *     sees unless something hands it over. That is what `recordError` is for.
 *
 * As with analytics, every function swallows its own errors. A reporter that
 * throws while reporting turns one handled error into an unhandled one.
 */

import { firebase } from './firebase';

/**
 * Reports a handled error, with optional context about what was happening.
 *
 *     recordError(error, { where: 'install', slug: app.slug })
 *
 * Context lands as Crashlytics attributes, which are what make a report
 * actionable — "it threw" is a bug report nobody can act on.
 */
export const recordError = (
  error: unknown,
  context?: Record<string, string | number | boolean>,
): void => {
  const fb = firebase();
  if (!fb) return;

  try {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        fb.crashlytics.setAttribute(
          fb.crashlyticsInstance as never,
          key as never,
          String(value) as never,
        );
      }
    }

    // Crashlytics only accepts a real Error; anything else loses its stack and
    // arrives as "[object Object]" with nothing to go on.
    const reportable = error instanceof Error ? error : new Error(String(error));
    fb.crashlytics.recordError(fb.crashlyticsInstance as never, reportable as never);
  } catch {
    /* see the file header */
  }
};

/**
 * Adds a breadcrumb to whatever report comes next.
 *
 * These are the log lines attached to a future crash — the trail of what the
 * user did just before it. They are not a general logger and cost a native
 * call each, so leave them on the paths that actually precede failures.
 */
export const breadcrumb = (message: string): void => {
  const fb = firebase();
  if (!fb) return;

  try {
    fb.crashlytics.log(fb.crashlyticsInstance as never, message as never);
  } catch {
    /* see the file header */
  }
};
