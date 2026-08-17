import Constants from 'expo-constants';

/**
 * Runtime configuration for the API layer.
 *
 * `apiBaseUrl` is read from `expo.extra.apiBaseUrl` in app.json (which can be
 * fed by an env var at build time). Until apps/api exists we default to the
 * mock provider — flip `useMockData` to false (or set extra.useMockData) once
 * the NestJS service is reachable on the Tailscale host.
 */

type Extra = {
  apiBaseUrl?: string;
  orgSlug?: string;
  useMockData?: boolean;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  /** Base URL of the NestJS API, e.g. https://appstore.tailnet.ts.net */
  apiBaseUrl: extra.apiBaseUrl ?? 'http://localhost:3000',
  /**
   * REST prefix. The API sets a global prefix of `v1` (apps/api/src/main.ts),
   * not `api/v1` — the ToR's `/api/v1` was never what the service actually
   * serves, and pointing here at the wrong one 404s every request.
   */
  apiPrefix: '/v1',
  /** Binary streaming route (outside the /api/v1 prefix). */
  downloadPrefix: '/download',
  /**
   * The organization this install belongs to. An internal store is deployed
   * per-company, so the org is configuration — not something a user types.
   */
  orgSlug: extra.orgSlug ?? 'maya',
  /** When true the app runs entirely off MockAppProvider. */
  useMockData: extra.useMockData ?? true,
  /** Simulated latency for the mock provider, in ms. */
  mockLatencyMs: 450,
  requestTimeoutMs: 15000,
} as const;

export const apiUrl = (path: string): string =>
  `${config.apiBaseUrl}${config.apiPrefix}${path}`;

export const downloadUrl = (path: string): string =>
  `${config.apiBaseUrl}${config.downloadPrefix}${path}`;
