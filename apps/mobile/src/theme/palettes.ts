/**
 * The two palettes.
 *
 * Both define exactly the same keys — `Palette` is derived from the dark one,
 * so a key added there fails to compile until light defines it too. That is the
 * whole safety story for theming: there is no way to ship a token that only one
 * scheme knows about.
 *
 * Light is NOT the dark palette inverted. Inverting produces grey mush: the
 * translucent-white fills that create depth on a dark canvas become invisible
 * on a light one, and a lavender tuned to carry dark text has far too little
 * contrast against white. Light therefore uses translucent BLACK for depth and
 * a deeper violet for anything that carries light text.
 */

export type ColorScheme = 'light' | 'dark';

export const darkPalette = {
  accent: '#A78BFA',
  accentPressed: '#9575F5',
  accentStrong: '#8B5CF6',
  accentDeep: '#6D28D9',
  onAccent: '#17121F',
  accentSoft: 'rgba(167,139,250,0.14)',
  accentSoftStrong: 'rgba(167,139,250,0.24)',

  background: '#0F0E13',
  backgroundElevated: '#17161D',
  backgroundSunken: '#0A0910',

  surface: 'rgba(255,255,255,0.045)',
  surfaceStrong: 'rgba(255,255,255,0.07)',
  surfacePressed: 'rgba(255,255,255,0.10)',
  surfaceInset: 'rgba(0,0,0,0.22)',

  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',

  scrim: 'rgba(6,5,10,0.72)',

  text: '#F6F4FF',
  textSecondary: 'rgba(246,244,255,0.60)',
  textTertiary: 'rgba(246,244,255,0.38)',
  textInverse: '#17121F',

  star: '#FBBF24',
  success: '#34D399',
  successSoft: 'rgba(52,211,153,0.14)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251,191,36,0.14)',
  danger: '#FB7185',
  dangerSoft: 'rgba(251,113,133,0.14)',
} as const;

export type Palette = { readonly [K in keyof typeof darkPalette]: string };

export const lightPalette: Palette = {
  // Deeper than the dark scheme's lavender: #A78BFA on white is roughly 1.9:1,
  // which fails every contrast floor there is. These carry WHITE text.
  accent: '#6D28D9',
  accentPressed: '#5B21B6',
  accentStrong: '#7C3AED',
  accentDeep: '#4C1D95',
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(109,40,217,0.10)',
  accentSoftStrong: 'rgba(109,40,217,0.18)',

  // Not pure white — a hint of violet keeps it the same product as the dark
  // scheme, and takes the glare off a full-screen catalog.
  background: '#FAF9FC',
  backgroundElevated: '#FFFFFF',
  backgroundSunken: '#F1EFF6',

  // Translucent BLACK. White-on-white would render depth invisible.
  surface: 'rgba(23,18,31,0.04)',
  surfaceStrong: 'rgba(23,18,31,0.07)',
  surfacePressed: 'rgba(23,18,31,0.11)',
  surfaceInset: 'rgba(23,18,31,0.05)',

  border: 'rgba(23,18,31,0.10)',
  borderStrong: 'rgba(23,18,31,0.18)',

  scrim: 'rgba(23,18,31,0.42)',

  text: '#17121F',
  textSecondary: 'rgba(23,18,31,0.66)',
  textTertiary: 'rgba(23,18,31,0.45)',
  textInverse: '#FFFFFF',

  // Darkened from the dark scheme's values, which are tuned to glow against
  // near-black and turn illegible on white.
  star: '#D97706',
  success: '#047857',
  successSoft: 'rgba(4,120,87,0.12)',
  warning: '#B45309',
  warningSoft: 'rgba(180,83,9,0.12)',
  danger: '#BE123C',
  dangerSoft: 'rgba(190,18,60,0.12)',
};

export const palettes: Record<ColorScheme, Palette> = {
  dark: darkPalette,
  light: lightPalette,
};
