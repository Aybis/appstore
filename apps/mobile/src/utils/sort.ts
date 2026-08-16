import type { App } from '../types';

export type SortKey = 'name' | 'recent' | 'rating';

export const SORT_OPTIONS: readonly { key: SortKey; label: string }[] = [
  { key: 'name', label: 'A–Z' },
  { key: 'recent', label: 'Recently updated' },
  { key: 'rating', label: 'Top rated' },
];

/** Returns a new array — never mutates the caller's list. */
export const sortApps = (apps: readonly App[], sort: SortKey): App[] =>
  [...apps].sort((a, b) => {
    if (sort === 'recent') return b.updatedAt.localeCompare(a.updatedAt);
    if (sort === 'rating') return b.rating - a.rating;
    return a.name.localeCompare(b.name);
  });
