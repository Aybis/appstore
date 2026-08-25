/**
 * Hands JS-side failures to Crashlytics.
 *
 * Crashlytics catches NATIVE crashes by itself. What it never sees without
 * help is the far more common case in a React Native app: a JS error that does
 * not take the process down. An unhandled promise rejection in a fetch, a
 * render that throws — the user sees a blank screen or a stuck spinner, the
 * process stays alive, and nothing is ever reported.
 *
 * Installed explicitly from the root layout rather than as an import side
 * effect, so the ordering is visible where it matters instead of depending on
 * module evaluation order.
 */

import { recordError } from './crash';

type ErrorHandler = (error: Error, isFatal?: boolean) => void;

type ErrorUtilsShape = {
  getGlobalHandler: () => ErrorHandler | undefined;
  setGlobalHandler: (handler: ErrorHandler) => void;
};

let installed = false;

export const installCrashHandlers = (): void => {
  // Fast Refresh re-runs this in development; chaining a handler onto itself
  // each time would report one error N times and grow with every save.
  if (installed) return;
  installed = true;

  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (!errorUtils) return;

  const previous = errorUtils.getGlobalHandler();

  errorUtils.setGlobalHandler((error, isFatal) => {
    recordError(error, { fatal: isFatal ?? false, source: 'global' });

    /*
     * Always delegate onward. The previous handler is what shows the redbox in
     * development and what terminates the process on a genuinely fatal error;
     * swallowing it here would mean reporting a crash while hiding it from the
     * developer who could fix it.
     */
    previous?.(error, isFatal);
  });
};
