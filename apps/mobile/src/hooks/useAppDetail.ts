import { useCallback } from 'react';
import { getClient } from '../api';
import { useAsync, type AsyncState } from './useAsync';
import type { App } from '../types';

/** Full app detail by slug (FR-1.5). */
export const useAppDetail = (slug: string | undefined): AsyncState<App> => {
  const task = useCallback(async () => {
    if (!slug) throw new Error('No app selected.');
    return getClient().getAppDetail(slug);
  }, [slug]);

  return useAsync(task, [slug]);
};
