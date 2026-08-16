import { useCallback } from 'react';
import { getClient } from '../api';
import { useAsync, type AsyncState } from './useAsync';
import type { App, ListAppsParams } from '../types';

/** Catalog listing with optional category filter and sort (FR-1.1/1.3/1.4). */
export const useApps = (params: ListAppsParams = {}): AsyncState<App[]> => {
  const { category = null, featuredOnly = false, sort = 'name' } = params;

  const task = useCallback(
    () => getClient().listApps({ category, featuredOnly, sort }),
    [category, featuredOnly, sort],
  );

  return useAsync(task, [category, featuredOnly, sort]);
};

/** Featured / recommended row on the catalog screen (FR-1.6). */
export const useFeaturedApps = (): AsyncState<App[]> =>
  useApps({ featuredOnly: true, sort: 'rating' });
