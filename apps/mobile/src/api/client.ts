import type {
  App,
  DownloadTicket,
  ListAppsParams,
  SearchAppsParams,
} from '../types';

/**
 * The single seam between the UI and the backend.
 *
 * Every screen and hook talks to this interface only — there are no `fetch`
 * calls anywhere else in the app. Swapping MockAppProvider for HttpAppProvider
 * is a one-line change in src/api/index.ts.
 */
export interface AppStoreClient {
  /** Catalog listing, optionally filtered/sorted (FR-1.1, FR-1.3, FR-1.4). */
  listApps(params?: ListAppsParams): Promise<App[]>;
  /** Full detail for one app by slug (FR-1.5). Rejects with ApiError 404. */
  getAppDetail(slug: string): Promise<App>;
  /** Name + description search (FR-1.2). */
  searchApps(params: SearchAppsParams): Promise<App[]>;
  /** Resolve a download/install target for the current release (FR-2.4/2.5). */
  downloadApp(slug: string): Promise<DownloadTicket>;
}

/** Normalized error every provider throws, so the UI renders one way. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: 'not_found' | 'network' | 'forbidden' | 'unknown';

  constructor(
    message: string,
    status = 0,
    code: ApiError['code'] = 'unknown',
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  static notFound(what: string): ApiError {
    return new ApiError(`${what} not found`, 404, 'not_found');
  }
}

/** Friendly, user-facing copy for any thrown value. */
export const toErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'not_found':
        return 'We could not find that app. It may have been unpublished.';
      case 'forbidden':
        return 'You do not have access to this app. Contact IT to request it.';
      case 'network':
        return 'Cannot reach the app store. Check your Tailscale connection.';
      default:
        return error.message;
    }
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
};
