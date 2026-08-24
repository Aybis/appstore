/**
 * The two palettes, as ROLES over the ramps in ramps.ts.
 *
 * Both define exactly the same keys — `Palette` is derived from the dark one,
 * so a key added there fails to compile until light defines it too. That is the
 * whole safety story for theming: there is no way to ship a token that only one
 * scheme knows about.
 *
 * Light is NOT the dark palette inverted, and the ramp makes that explicit
 * rather than a matter of taste: the two schemes point the same role names at
 * different STEPS, and where they point at the same step it is because that
 * step genuinely works on both grounds.
 *
 * PRIMARY ACTIONS ARE MONOCHROME — near-black on light, near-white on dark.
 * They used to be violet. A filled accent button pulls the eye on every screen,
 * and once every screen has one, none of them means anything. Colour is spent
 * instead on `highlight`, which marks the one thing that is currently active,
 * and on content: app icons, rating stars, install state.
 */

import { amber, coral, green, neutral, red } from './ramps';

export type ColorScheme = 'light' | 'dark';

export const darkPalette = {
  accent: neutral[50],
  accentPressed: neutral[200],
  accentStrong: neutral[0],
  accentDeep: neutral[200],
  onAccent: neutral[950],
  accentSoft: 'rgba(255,255,255,0.09)',
  accentSoftStrong: 'rgba(255,255,255,0.16)',

  /**
   * The one piece of colour in the chrome: the current tab, and focus.
   *
   * coral[600] measures about 3:1 on this ground and would be unreadable as
   * the state colour it exists to be, so dark points a step lighter.
   */
  highlight: coral[300],
  highlightSoft: 'rgba(255,154,172,0.16)',

  background: neutral[950],
  backgroundElevated: neutral[900],
  backgroundSunken: '#000000',

  // Translucent WHITE for depth: a solid step would not layer over the
  // elevated surfaces it sits on.
  surface: 'rgba(255,255,255,0.05)',
  surfaceStrong: 'rgba(255,255,255,0.09)',
  surfacePressed: 'rgba(255,255,255,0.13)',
  surfaceInset: 'rgba(0,0,0,0.30)',

  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.22)',

  scrim: 'rgba(0,0,0,0.70)',

  text: neutral[50],
  textSecondary: neutral[300],
  textTertiary: neutral[400],
  textInverse: neutral[950],

  star: amber[500],
  success: green[500],
  successSoft: 'rgba(22,163,74,0.16)',
  warning: amber[500],
  warningSoft: 'rgba(245,158,11,0.14)',
  danger: red[500],
  dangerSoft: 'rgba(239,68,68,0.14)',
} as const;

export type Palette = { readonly [K in keyof typeof darkPalette]: string };

export const lightPalette: Palette = {
  accent: neutral[900],
  accentPressed: neutral[800],
  accentStrong: neutral[950],
  accentDeep: neutral[950],
  onAccent: neutral[0],
  accentSoft: neutral[100],
  accentSoftStrong: neutral[200],

  highlight: coral[600],
  highlightSoft: coral[100],

  // White, not the old violet-tinted off-white. The tint was doing the work of
  // separating cards from the page; a hairline does it now, and the page can
  // be plain.
  background: neutral[0],
  backgroundElevated: neutral[0],
  backgroundSunken: neutral[50],

  // Solid steps rather than translucent black: on a white ground a 4%-black
  // fill and a named grey are the same thing, and the named one is legible in
  // a diff.
  surface: neutral[100],
  surfaceStrong: neutral[200],
  surfacePressed: neutral[300],
  surfaceInset: neutral[50],

  border: neutral[200],
  borderStrong: neutral[300],

  scrim: 'rgba(11,11,13,0.50)',

  text: neutral[900],
  textSecondary: neutral[600],
  // neutral[500], where dark uses neutral[400]. No single step clears 4.5:1 on
  // both grounds — 500 measures 4.8 on white and 4.1 on near-black — and
  // pointing one role at two steps is exactly what this layer is for.
  textTertiary: neutral[500],
  textInverse: neutral[0],

  star: amber[700],
  success: green[600],
  successSoft: 'rgba(22,163,74,0.10)',
  warning: amber[700],
  warningSoft: 'rgba(245,158,11,0.12)',
  danger: red[600],
  dangerSoft: 'rgba(239,68,68,0.10)',
};

export const palettes: Record<ColorScheme, Palette> = {
  dark: darkPalette,
  light: lightPalette,
};
