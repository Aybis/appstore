/**
 * Design tokens — white, minimal, premium, with a single blue accent.
 * Every component reads from here; no raw hex values in screens.
 */

export const colors = {
  accent: '#4a6cf7',
  accentPressed: '#3a58d6',
  accentSoft: '#eef1fe',

  background: '#ffffff',
  surface: '#ffffff',
  surfaceMuted: '#f6f7f9',

  border: '#e8eaef',
  borderStrong: '#d7dae2',

  text: '#0d1117',
  textSecondary: '#5b6472',
  textTertiary: '#8b94a3',
  textInverse: '#ffffff',

  star: '#f5a623',
  success: '#128a5b',
  warning: '#b26a00',
  danger: '#d93838',
  dangerSoft: '#fdecec',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
} as const;

/** Subtle elevation — premium look leans on borders more than shadows. */
export const shadow = {
  card: {
    shadowColor: '#0d1117',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

/** Deterministic accent pair per app, used by icon/screenshot placeholders. */
export const placeholderPalette: readonly [string, string][] = [
  ['#4a6cf7', '#7a92ff'],
  ['#128a5b', '#4bc48d'],
  ['#f5a623', '#ffc766'],
  ['#8b5cf6', '#b794f6'],
  ['#e0537a', '#f38fa9'],
  ['#0ea5a5', '#5fd6d6'],
];
