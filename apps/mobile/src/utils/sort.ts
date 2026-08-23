import type { App } from '../types';

export type SortKey = 'name' | 'recent' | 'rating';

/**
 * Sort keys and the string key each one's label lives under. The label itself
 * is NOT here: this module is imported by the sorting logic, and baking English
 * into it would make the sort order and its presentation impossible to
 * translate independently.
 */
export const SORT_OPTIONS: readonly { key: SortKey; labelKey: 'sort.name' | 'sort.recent' | 'sort.rating' }[] = [
  { key: 'name', labelKey: 'sort.name' },
  { key: 'recent', labelKey: 'sort.recent' },
  { key: 'rating', labelKey: 'sort.rating' },
];

/** Returns a new array — never mutates the caller's list. */
export const sortApps = (apps: readonly App[], sort: SortKey): App[] =>
  [...apps].sort((a, b) => {
    if (sort === 'recent') return b.updatedAt.localeCompare(a.updatedAt);
    if (sort === 'rating') return b.rating - a.rating;
    return a.name.localeCompare(b.name);
  });
