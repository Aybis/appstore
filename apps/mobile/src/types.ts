/**
 * Domain types shared across the mobile app.
 *
 * These mirror the `apps`/`app_versions` shape described in docs/02-tor/ToR.md.
 * Keep them structural (no class instances) so the same objects can come from
 * the mock provider or straight off the wire from the NestJS API.
 */

export type Platform = 'android' | 'ios';

/**
 * Categories are data, not a closed set: they come from `apps.category` in the
 * API, so the union that used to live here would reject any catalog whose
 * categories differ from the original mock (HR/Finance/Tools/Sales/Ops). The
 * constant below is only the fallback used before the first fetch resolves.
 */
export type Category = string;

export const CATEGORIES: readonly Category[] = [
  'Social',
  'Media',
  'Kids',
  'Tools',
  'Productivity',
  'Navigation',
];

/** Access state surfaced in the UI (BRD FR-4.4). */
export type AccessStatus = 'available' | 'restricted' | 'unsupported';

export type App = {
  id: string;
  slug: string;
  name: string;
  category: Category;
  version: string;
  /** Binary size in bytes; formatted for display via `formatBytes`. */
  size: number;
  screenshotUrls: string[];
  /** Short one-liner used on cards. */
  tagline: string;
  description: string;
  releaseNotes: string;
  /** Human-readable minimum OS, e.g. "Android 9.0". */
  minOs: string;
  /** Aggregate rating, 0–5. */
  rating: number;
  ratingCount: number;
  featured: boolean;
  platform: Platform;
  publisher: string;
  /** ISO-8601 date of the current release. */
  updatedAt: string;
  accessStatus: AccessStatus;
};

/** Result of kicking off a download (BRD FR-2.4 / FR-2.5). */
export type DownloadTicket = {
  appId: string;
  version: string;
  /** Absolute URL the client should open or stream from. */
  url: string;
  sizeBytes: number;
  /** SHA-256 of the binary, when the backend has computed it. */
  checksum?: string;
  platform: Platform;
  /** iOS has no direct-install path in v1 — show instructions instead. */
  instructions?: string;
};

export type ListAppsParams = {
  category?: Category | null;
  featuredOnly?: boolean;
  sort?: 'name' | 'recent' | 'rating';
};

export type SearchAppsParams = {
  query: string;
  category?: Category | null;
};
