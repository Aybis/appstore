import { placeholderPalette } from '../constants/theme';
import type { AccessStatus } from '../types';

/** 42318233 → "42.3 MB" (decimal MB, matching how stores report size). */
export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1000)),
    units.length - 1,
  );
  const value = bytes / 1000 ** exponent;
  const decimals = exponent === 0 ? 0 : value < 10 ? 1 : value < 100 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
};

/** "2026-07-28" → "28 Jul 2026". Returns the input if it is not parseable. */
export const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${parsed.getUTCDate()} ${months[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
};

/** 4.62 → "4.6"; used so ratings never render as 4.6000000000000005. */
export const formatRating = (rating: number): string => rating.toFixed(1);

/** 218 → "218", 1240 → "1.2k" */
export const formatCount = (count: number): string =>
  count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);

/** Stable hash so a given slug always gets the same placeholder colors. */
export const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // force int32
  }
  return Math.abs(hash);
};

export const paletteFor = (seed: string): readonly [string, string] => {
  const entry = placeholderPalette[hashString(seed) % placeholderPalette.length];
  // placeholderPalette is a non-empty literal, so the lookup always resolves.
  return entry ?? placeholderPalette[0]!;
};

/** First letters of an app name, e.g. "HR Portal" → "HP". */
export const initialsFor = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

export const accessLabel: Record<AccessStatus, string> = {
  available: 'Available',
  restricted: 'Restricted',
  unsupported: 'Unsupported device',
};
