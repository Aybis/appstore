/**
 * Numbered colour ramps.
 *
 * These name colours and nothing else — `neutral[700]` is a grey, not a
 * border. Meaning is assigned in palettes.ts, where every role points at one
 * of these steps.
 *
 * The same values the console uses, deliberately: a publisher who sets a
 * release live in the browser and then opens the app on their phone should be
 * looking at one product. Keeping the ramps identical means the two can only
 * drift where a role was mapped differently, which is a visible decision
 * rather than an accident of two hand-picked palettes.
 */

export const neutral = {
  0: '#FFFFFF',
  50: '#FAFAFA',
  100: '#F4F4F5',
  200: '#E9E9EC',
  300: '#D6D6DB',
  400: '#A5A5AE',
  500: '#71717A',
  600: '#5B5B62',
  700: '#3F3F46',
  800: '#27272A',
  900: '#18181B',
  950: '#0B0B0D',
} as const;

/**
 * Coral, and a short ramp on purpose.
 *
 * It appears in very few places — the current tab, a focus ring — so a full
 * twelve steps would be inventing values nothing uses.
 */
export const coral = {
  100: '#FFE4E9',
  300: '#FF9AAC',
  500: '#F04A6B',
  600: '#D62B4F',
  700: '#B81F40',
  900: '#6B0F24',
} as const;

export const green = { 500: '#16A34A', 600: '#15803D' } as const;
export const amber = { 500: '#F59E0B', 700: '#B45309' } as const;
export const red = { 500: '#EF4444', 600: '#DC2626' } as const;
