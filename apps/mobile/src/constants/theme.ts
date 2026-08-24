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
  /**
   * The brand sweep — the app mark and hero panels.
   *
   * Coral now, matching the console. It is used far less than it was: primary
   * emphasis is monochrome, so this survives only where the mark itself is
   * drawn and where a hero genuinely wants a wash.
   */
  brand: ['#D62B4F', '#F04A6B', '#FF9AAC'] as const,
  /** Deeper variant for large fills where the light end would glare. */
  brandDeep: ['#6B0F24', '#B81F40', '#F04A6B'] as const,
  /** Top-down wash that lifts a card off the canvas without a border. */
  surfaceLift: ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)'] as const,
  /** Fades content into the canvas under a sticky bar. */
  canvasFade: ['rgba(11,11,13,0)', 'rgba(11,11,13,0.92)', '#0B0B0D'] as const,
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
  /**
   * Glow under the primary button.
   *
   * Now near-black, because the primary button is. A coral glow under a black
   * button would read as a rendering fault rather than as emphasis.
   */
  accentGlow: {
    shadowColor: '#0B0B0D',
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
 *
 * This is CONTENT, and it stays colourful on purpose. With the chrome now
 * monochrome, these are most of the colour on a catalog screen — which is the
 * point: an app should be recognisable by its mark before its name is read.
 *
 * The same six hues the console generates, so one app looks like itself in
 * both places.
 */
export const placeholderPalette: readonly [string, string][] = [
  ['#FF9AAC', '#FFD3DB'],
  ['#FFB088', '#FFD9C2'],
  ['#F5CE55', '#FAE6A6'],
  ['#7ED4A0', '#B8E9CC'],
  ['#9CB8FF', '#CBD9FF'],
  ['#D0A0EE', '#E6CCF6'],
];
