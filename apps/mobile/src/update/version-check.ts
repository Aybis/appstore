import Constants from 'expo-constants';

import { apiUrl, config } from '../api/config';

/**
 * Client for `GET /v1/version-check` — the endpoint a distributed app calls on
 * launch to find out whether it is still current.
 *
 * Deliberately standalone: no auth header, no shared client, no provider. The
 * apps that need this (HR Portal, Calculator) are NOT the store, hold no user
 * session, and should be able to adopt update-gating by copying this file and
 * `UpdateGate.tsx` without taking on the rest of MAYA. That is also why the
 * request is a bare `fetch` rather than going through `getClient()`.
 */

export type UpdateSeverity = 'none' | 'minor' | 'major';

export interface VersionCheck {
  packageId: string;
  platform: 'android' | 'ios';
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  /** `major` (first or second digit moved) must not be dismissible. */
  severity: UpdateSeverity;
  /** True when the update cannot be dismissed — major, or below the floor. */
  updateRequired: boolean;
  releaseNotes: string;
  publishedAt: string | null;
  /** Deep link that opens this app's page in the store client. */
  storeUrl: string;
}

export interface VersionCheckQuery {
  packageId: string;
  platform: 'android' | 'ios';
  version: string;
  orgSlug?: string;
}

/**
 * Returns null rather than throwing when the check cannot be completed.
 *
 * An update prompt is not worth blocking a launch over: if the store is
 * unreachable, or the package has no published release yet, the correct
 * behaviour is to let the user into the app they already have. A forced update
 * that fires because the network was down is worse than a missed one.
 */
export const fetchVersionCheck = async (
  query: VersionCheckQuery,
  signal?: AbortSignal,
): Promise<VersionCheck | null> => {
  const params = new URLSearchParams({
    org: query.orgSlug ?? config.orgSlug,
    packageId: query.packageId,
    platform: query.platform,
    version: query.version,
  });

  try {
    const response = await fetch(`${apiUrl('/version-check')}?${params.toString()}`, { signal });
    if (!response.ok) return null;
    return (await response.json()) as VersionCheck;
  } catch {
    return null;
  }
};

/** What this build reports as its own version. */
export const runningVersion = (): string =>
  Constants.expoConfig?.version ?? '0.0.0';
