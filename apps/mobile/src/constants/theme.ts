/**
 * Design tokens — dark, violet, glassy.
 *
 * The visual language: a near-black canvas with a violet cast, surfaces
 * separated by translucent fill rather than strokes, generous corner radii, a
 * single lavender accent that carries dark text, and motion that springs
 * instead of easing. Every component reads from here; no raw hex in screens.
 *
 * Surfaces are rgba-on-canvas, not opaque greys, so a card stacked on a sheet
 * stacked on the canvas reads as three depths without three hard-coded colors.
 */

// `colors` is a live proxy over the active palette, not a static object — see
// src/theme/active.ts for why, and for the `themedStyles` rule that goes with it.
export { colors, themedStyles } from '../theme/active';
export type { ColorScheme, Palette } from '../theme/palettes';

/**
 * Multi-stop gradients. Consumed by expo-linear-gradient, which wants a
 * mutable `string[]`, so these are typed as tuples and spread at the call site.
 */
export const gradients = {
  /** The brand sweep — hero panels, the app mark, primary emphasis. */
  brand: ['#8B5CF6', '#A78BFA', '#C4B5FD'] as const,
  /** Deeper variant for large fills where the light end would glare. */
  brandDeep: ['#5B21B6', '#7C3AED', '#A78BFA'] as const,
  /** Top-down wash that lifts a card off the canvas without a border. */
  surfaceLift: ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)'] as const,
  /** Fades content into the canvas under a sticky bar. */
  canvasFade: ['rgba(15,14,19,0)', 'rgba(15,14,19,0.92)', '#0F0E13'] as const,
  /** Darkens the bottom of a screenshot so overlaid text stays legible. */
  imageScrim: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)'] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Corner radii run large — roundness is most of the signature. */
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  xxl: 32,
  pill: 999,
} as const;

export const typography = {
  hero: { fontSize: 34, fontWeight: '800', letterSpacing: -0.9 },
  display: { fontSize: 28, fontWeight: '800', letterSpacing: -0.7 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  caption: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  mono: { fontSize: 12, fontWeight: '500', letterSpacing: 0.4 },
} as const;

/**
 * On a dark canvas a black shadow is invisible, so elevation is carried by the
 * surface fill instead. These exist for the few places that float above
 * everything — sheets, the install bar, a pressed card lifting off the list.
 */
export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  sheet: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  /** Coloured glow under the primary button — the accent, not black. */
  accentGlow: {
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
} as const;

/** Blur intensities for expo-blur, so glass is consistent across surfaces. */
export const blur = {
  tabBar: 44,
  header: 32,
  sheet: 60,
} as const;

/**
 * Deterministic accent pair per app, used by icon/screenshot placeholders.
 * Retuned for a dark canvas: saturated, mid-luminance, none of them muddy.
 */
export const placeholderPalette: readonly [string, string][] = [
  ['#8B5CF6', '#C4B5FD'],
  ['#3B82F6', '#93C5FD'],
  ['#EC4899', '#F9A8D4'],
  ['#10B981', '#6EE7B7'],
  ['#F59E0B', '#FCD34D'],
  ['#06B6D4', '#67E8F9'],
];
