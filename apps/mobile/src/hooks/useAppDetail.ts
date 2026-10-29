import { useCallback } from 'react';
import { getClient } from '../services/api';
import { track } from '../services/telemetry';
import { useAsync, type AsyncState } from './useAsync';
import type { App } from '../types';

/** Full app detail by slug (FR-1.5). */
export const useAppDetail = (slug: string | undefined): AsyncState<App> => {
  const task = useCallback(async () => {
    if (!slug) throw new Error('No app selected.');
    const app = await getClient().getAppDetail(slug);
    // The screen view is reported as `app_slug` for every app (see
    // screenNameFrom); this is what says WHICH app, so "viewed but never
    // installed" can be read per app against install_started.
    track('app_viewed', { slug: app.slug, version: app.version });
    return app;
  }, [slug]);

  return useAsync(task, [slug]);
};
