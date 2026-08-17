import { Platform } from 'react-native';

import { ApiError, type AppStoreClient } from './client';
import { apiUrl, config } from './config';
import type {
  App,
  DownloadTicket,
  ListAppsParams,
  SearchAppsParams,
} from '../types';

/**
 * REST implementation against the NestJS API (apps/api), per ToR §API surface:
 *   GET /api/v1/apps             ?category=&featured=&sort=
 *   GET /api/v1/apps/:slug
 *   GET /api/v1/apps/search      ?q=&category=
 *   GET /api/v1/apps/:slug/download   → { url, checksum, ... }
 *
 * The service does not exist yet, so this provider is unused at runtime
 * (config.useMockData is true). It is kept in sync with the interface so the
 * swap is a one-line change in src/api/index.ts.
 */
export class HttpAppProvider implements AppStoreClient {
  private readonly getToken: () => string | null;
  /** Exchanges the refresh token for a new access token, or null if it failed. */
  private readonly refresh: () => Promise<string | null>;

  constructor(
    getToken: () => string | null = () => null,
    refresh: () => Promise<string | null> = async () => null,
  ) {
    this.getToken = getToken;
    this.refresh = refresh;
  }

  /**
   * Access tokens live 15 minutes, so a 401 mid-session is routine rather than
   * exceptional. Refresh once and replay before surfacing an error — otherwise
   * the UI reports "you do not have access" for what is only an expired token.
   */
  private async request<T>(path: string, allowRetry = true): Promise<T> {
    try {
      return await this.send<T>(path);
    } catch (error) {
      const unauthorized =
        error instanceof ApiError && (error.status === 401 || error.status === 403);
      if (!unauthorized || !allowRetry) throw error;

      const renewed = await this.refresh();
      if (!renewed) throw error;
      return this.request<T>(path, false);
    }
  }

  private async send<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.requestTimeoutMs,
    );
    const token = this.getToken();

    try {
      const response = await fetch(apiUrl(path), {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        if (response.status === 404) throw ApiError.notFound('Resource');
        if (response.status === 401 || response.status === 403) {
          throw new ApiError('Access denied', response.status, 'forbidden');
        }
        throw new ApiError(
          `Request failed (${response.status})`,
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Network request failed', 0, 'network');
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Every request is pinned to this device's platform.
   *
   * Without it an iPhone is offered APK-only apps it can never install, and an
   * Android device is offered IPAs — the catalog holds both, and a release is
   * per-platform. The API narrows the release lateral join on this parameter.
   */
  private get platform(): 'ios' | 'android' {
    return Platform.OS === 'ios' ? 'ios' : 'android';
  }

  listApps(params: ListAppsParams = {}): Promise<App[]> {
    const query = new URLSearchParams({ platform: this.platform });
    if (params.category) query.set('category', params.category);
    if (params.featuredOnly) query.set('featured', 'true');
    if (params.sort) query.set('sort', params.sort);
    return this.request<App[]>(`/apps?${query}`);
  }

  getAppDetail(slug: string): Promise<App> {
    const query = new URLSearchParams({ platform: this.platform });
    return this.request<App>(`/apps/${encodeURIComponent(slug)}?${query}`);
  }

  searchApps({ query, category }: SearchAppsParams): Promise<App[]> {
    const params = new URLSearchParams({ q: query, platform: this.platform });
    if (category) params.set('category', category);
    return this.request<App[]>(`/apps/search?${params}`);
  }

  downloadApp(slug: string): Promise<DownloadTicket> {
    const query = new URLSearchParams({ platform: this.platform });
    return this.request<DownloadTicket>(
      `/apps/${encodeURIComponent(slug)}/download?${query}`,
    );
  }
}
