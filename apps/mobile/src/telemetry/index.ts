/**
 * Crash and analytics reporting for the app.
 *
 * Plain functions, callable from anywhere, that do nothing at all until
 * Firebase credentials are present — see ./firebase for the four states this
 * is built to run in, and app.config.js for how the native side is gated.
 */

export { track, trackScreen, identify, resetIdentity, type EventParams } from './analytics';
export { recordError, breadcrumb } from './crash';
export { installCrashHandlers } from './handlers';
export { useScreenTracking, screenNameFrom } from './screens';
export { isTelemetryActive } from './firebase';
