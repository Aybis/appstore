/**
 * The version check: "is this install current, and if not, how hard do we
 * push?" — answered by MAYA's public `GET /v1/version-check`.
 *
 * No session and no key: the calling app is not MAYA and has no MAYA user. It
 * names its org and package id, and gets back version metadata, a deep link
 * into MAYA, and — only if an admin allowed in-place updates for this app — a
 * signed, short-lived download URL.
 */

export type Platform = 'android' | 'ios';
export type UpdateSeverity = 'none' | 'minor' | 'major';

/**
 * Named after Google Play's in-app updates, because they mean the same thing:
 *
 *   - `immediate`: the app cannot be used until it is updated (the first or
 *     second number of the version changed, or the build is below the app's
 *     minimum version);
 *   - `flexible`: the user may postpone it (only the last number changed).
 */
export type UpdateFlow = 'immediate' | 'flexible';

/** The API's answer, as returned. */
export interface VersionCheckResponse {
  packageId: string;
  platform: Platform;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  severity: UpdateSeverity;
  updateRequired: boolean;
  releaseNotes: string;
  publishedAt: string | null;
  /** Deep link to this app's page in MAYA, e.g. maya://app/hr-portal. */
  storeUrl: string;
  /** Only with in-place updates allowed: signed, expiring. */
  downloadUrl?: string;
  downloadExpiresAt?: string;
  sha256?: string;
  sizeBytes?: number;
}

export interface UpdateInfo extends VersionCheckResponse {
  flow: UpdateFlow;
  /** True when the app may install the update itself rather than via MAYA. */
  canUpdateInPlace: boolean;
}

export interface CheckOptions {
  /** MAYA API origin, e.g. https://maya-api.example.com (no /v1). */
  apiBaseUrl: string;
  /** The organization slug in MAYA. */
  org: string;
  /** This app's package name (Android) or bundle id (iOS). */
  packageId: string;
  platform: Platform;
  /** The version this build reports, e.g. Constants.expoConfig.version. */
  currentVersion: string;
  /**
   * A random id this install keeps for itself, so the console counts installs
   * per day rather than launches. Optional; never send a hardware id.
   */
  installKey?: string;
  signal?: AbortSignal;
  /** Defaults to 8 seconds. A slow store is never a reason to hold a launch. */
  timeoutMs?: number;
}

const withTimeout = (signal: AbortSignal | undefined, ms: number): AbortSignal => {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  // AbortSignal.any is not on every Hermes yet; combine by hand.
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  timeout.addEventListener('abort', abort, { once: true });
  return controller.signal;
};

/** Pure, so the decision can be tested without a network. */
export const toUpdateInfo = (response: VersionCheckResponse): UpdateInfo => ({
  ...response,
  flow: response.updateRequired ? 'immediate' : 'flexible',
  canUpdateInPlace:
    Boolean(response.downloadUrl) &&
    (!response.downloadExpiresAt || Date.parse(response.downloadExpiresAt) > Date.now()),
});

/**
 * Returns the update, or null when there is none OR when the check could not
 * be completed.
 *
 * Null on failure is deliberate: a forced update that fires because the
 * network was down locks people out of an app that works. When MAYA cannot be
 * reached, the right answer is to let the user in.
 */
export const checkForUpdate = async (options: CheckOptions): Promise<UpdateInfo | null> => {
  const params = new URLSearchParams({
    org: options.org,
    packageId: options.packageId,
    platform: options.platform,
    version: options.currentVersion,
  });
  if (options.installKey) params.set('install', options.installKey);

  const base = options.apiBaseUrl.replace(/\/$/, '');
  try {
    const response = await fetch(`${base}/v1/version-check?${params.toString()}`, {
      signal: withTimeout(options.signal, options.timeoutMs ?? 8000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as VersionCheckResponse;
    return body.updateAvailable ? toUpdateInfo(body) : null;
  } catch {
    return null;
  }
};
