import { useCallback, useEffect, useState } from 'react';
import { getClient } from '../services/api';
import { track } from '../services/telemetry';
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

  const task = useCallback(async () => {
    const results = await getClient().searchApps({ query: debouncedQuery, category });
    /*
     * Counted after the debounce, so one search is one event rather than one
     * per keystroke. The query text itself is NOT sent: people search for
     * colleagues' names and project codenames, and that does not belong in
     * an analytics console. Zero-result searches are the number that matters —
     * they are what people looked for and the catalog did not have.
     */
    if (debouncedQuery) {
      track('search', {
        result_count: results.length,
        no_results: results.length === 0,
        query_length: debouncedQuery.length,
        in_category: category !== null,
      });
    }
    return results;
  }, [debouncedQuery, category]);

  const state = useAsync(task, [debouncedQuery, category]);

  return { ...state, query, setQuery, active: debouncedQuery.length > 0 };
};
