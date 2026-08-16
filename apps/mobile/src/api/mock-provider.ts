import { ApiError, type AppStoreClient } from './client';
import { config, downloadUrl } from './config';
import { MOCK_APPS } from './mock-data';
import type {
  App,
  DownloadTicket,
  ListAppsParams,
  SearchAppsParams,
} from '../types';

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const byName = (a: App, b: App): number => a.name.localeCompare(b.name);
const byRecent = (a: App, b: App): number =>
  b.updatedAt.localeCompare(a.updatedAt);
const byRating = (a: App, b: App): number => b.rating - a.rating;

const sorters: Record<NonNullable<ListAppsParams['sort']>, typeof byName> = {
  name: byName,
  recent: byRecent,
  rating: byRating,
};

/**
 * In-memory implementation of AppStoreClient.
 *
 * Mirrors the semantics the NestJS API will have (filtering, FTS-style search
 * over name + description, 404 on unknown slug) plus artificial latency, so
 * loading and error states are exercised during development.
 */
export class MockAppProvider implements AppStoreClient {
  private readonly apps: App[];
  private readonly latencyMs: number;

  constructor(apps: App[] = MOCK_APPS, latencyMs = config.mockLatencyMs) {
    // Clone so callers mutating results cannot corrupt the fixture.
    this.apps = apps.map((app) => ({ ...app }));
    this.latencyMs = latencyMs;
  }

  async listApps(params: ListAppsParams = {}): Promise<App[]> {
    await delay(this.latencyMs);
    const { category = null, featuredOnly = false, sort = 'name' } = params;

    return this.apps
      .filter((app) => (category ? app.category === category : true))
      .filter((app) => (featuredOnly ? app.featured : true))
      .sort(sorters[sort]);
  }

  async getAppDetail(slug: string): Promise<App> {
    await delay(this.latencyMs);
    const app = this.apps.find((candidate) => candidate.slug === slug);
    if (!app) throw ApiError.notFound(`App "${slug}"`);
    return { ...app };
  }

  async searchApps({ query, category = null }: SearchAppsParams): Promise<App[]> {
    await delay(Math.round(this.latencyMs / 2));
    const needle = query.trim().toLowerCase();
    if (!needle) return this.listApps({ category });

    return this.apps
      .filter((app) => (category ? app.category === category : true))
      .filter((app) =>
        [app.name, app.tagline, app.description, app.category, app.publisher]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
      .sort(byName);
  }

  async downloadApp(slug: string): Promise<DownloadTicket> {
    await delay(this.latencyMs);
    const app = this.apps.find((candidate) => candidate.slug === slug);
    if (!app) throw ApiError.notFound(`App "${slug}"`);
    if (app.accessStatus === 'restricted') {
      throw new ApiError('Access restricted', 403, 'forbidden');
    }

    return {
      appId: app.id,
      version: app.version,
      url: downloadUrl(`/${app.id}/stream`),
      sizeBytes: app.size,
      platform: app.platform,
      instructions:
        app.platform === 'ios'
          ? 'iOS builds are installed through the MDM profile. Open this page on the device and tap Install, or ask IT to push the build to your enrolled device.'
          : undefined,
    };
  }
}
