import type { AppStoreClient } from './client';
import { config } from './config';
import { HttpAppProvider } from './http-provider';
import { MockAppProvider } from './mock-provider';

export { ApiError, toErrorMessage } from './client';
export type { AppStoreClient } from './client';
export { config } from './config';
export { MockAppProvider } from './mock-provider';
export { HttpAppProvider } from './http-provider';

let instance: AppStoreClient | null = null;

/**
 * Single entry point for data access. Every hook resolves its provider here.
 *
 * To go live against apps/api: set `expo.extra.useMockData` to false (and
 * `expo.extra.apiBaseUrl` to the Tailscale host) in app.json — no UI changes.
 */
export const getClient = (): AppStoreClient => {
  if (!instance) {
    instance = config.useMockData
      ? new MockAppProvider()
      : new HttpAppProvider();
  }
  return instance;
};

/** Override the client — used by tests and by the auth layer (token wiring). */
export const setClient = (client: AppStoreClient): void => {
  instance = client;
};
