import { useCallback, useEffect, useState } from 'react';
import { getClient } from '../api';
import { useAsync, type AsyncState } from './useAsync';
import type { App, Category } from '../types';

/** Debounce any fast-changing value (search input) before hitting the API. */
export const useDebounced = <T>(value: T, delayMs = 300): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};

export type SearchState = AsyncState<App[]> & {
  query: string;
  setQuery: (next: string) => void;
  /** True once the user has typed something worth searching for. */
  active: boolean;
};

/**
 * Debounced name/description search (FR-1.2). An empty query falls back to the
 * full (category-filtered) catalog, so the screen has one data source.
 */
export const useSearch = (category: Category | null = null): SearchState => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query.trim());

  const task = useCallback(
    () => getClient().searchApps({ query: debouncedQuery, category }),
    [debouncedQuery, category],
  );

  const state = useAsync(task, [debouncedQuery, category]);

  return { ...state, query, setQuery, active: debouncedQuery.length > 0 };
};
