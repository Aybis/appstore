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
  useMockData?: boolean;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  /** Base URL of the NestJS API, e.g. https://appstore.tailnet.ts.net */
  apiBaseUrl: extra.apiBaseUrl ?? 'http://localhost:3000',
  /** REST prefix per ToR §API surface. */
  apiPrefix: '/api/v1',
  /** Binary streaming route (outside the /api/v1 prefix). */
  downloadPrefix: '/download',
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
