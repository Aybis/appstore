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

  constructor(getToken: () => string | null = () => null) {
    this.getToken = getToken;
  }

  private async request<T>(path: string): Promise<T> {
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

  listApps(params: ListAppsParams = {}): Promise<App[]> {
    const query = new URLSearchParams();
    if (params.category) query.set('category', params.category);
    if (params.featuredOnly) query.set('featured', 'true');
    if (params.sort) query.set('sort', params.sort);
    const suffix = query.toString() ? `?${query}` : '';
    return this.request<App[]>(`/apps${suffix}`);
  }

  getAppDetail(slug: string): Promise<App> {
    return this.request<App>(`/apps/${encodeURIComponent(slug)}`);
  }

  searchApps({ query, category }: SearchAppsParams): Promise<App[]> {
    const params = new URLSearchParams({ q: query });
    if (category) params.set('category', category);
    return this.request<App[]>(`/apps/search?${params}`);
  }

  downloadApp(slug: string): Promise<DownloadTicket> {
    return this.request<DownloadTicket>(
      `/apps/${encodeURIComponent(slug)}/download`,
    );
  }
}
