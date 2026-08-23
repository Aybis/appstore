/**
 * The active palette, and the `colors` proxy every component reads through.
 *
 * WHY A PROXY, AND WHY A THUNK FOR STYLES
 *
 * `StyleSheet.create({ card: { backgroundColor: colors.surface } })` runs ONCE,
 * at module load, and copies the resolved colour string into the style object.
 * That is fundamentally incompatible with switching themes at runtime — the
 * value was captured before the user ever touched a toggle.
 *
 * The alternative is converting all 43 stylesheet-bearing components into hooks
 * (`const styles = useStyles()`), which means editing every component body and
 * converting implicit-return arrows into block bodies. A lot of churn, and a lot
 * of chances to break a working screen.
 *
 * Instead: `colors` is a proxy that reads whatever palette is active AT ACCESS
 * TIME, and `themedStyles` takes a thunk it can re-invoke per palette. Inline
 * uses (`<StarIcon color={colors.star} />`) evaluate during render and are
 * correct for free; stylesheets re-resolve when the palette generation changes.
 * The per-file change is then two mechanical lines, not a rewrite.
 *
 * The catch, stated plainly: a component only picks up new colours when it
 * re-renders, and nothing here subscribes it to the palette. ThemeProvider
 * therefore remounts the tree on change (see its `key`). That discards
 * in-flight component state — scroll offsets, half-typed form fields — which is
 * an acceptable price for an action a user takes deliberately and rarely.
 */

import { StyleSheet } from 'react-native';

import { darkPalette, palettes, type ColorScheme, type Palette } from './palettes';

let activeScheme: ColorScheme = 'dark';
let activePalette: Palette = darkPalette;

/** Bumped on every scheme change; memoised stylesheets compare against it. */
let generation = 0;

export const getActiveScheme = (): ColorScheme => activeScheme;
export const getActivePalette = (): Palette => activePalette;

/** Called by ThemeProvider during render, before any child reads `colors`. */
export const setActiveScheme = (scheme: ColorScheme): void => {
  if (scheme === activeScheme) return;
  activeScheme = scheme;
  activePalette = palettes[scheme];
  generation += 1;
};

/**
 * Reads as a plain palette object at every call site and in the type system,
 * but resolves against whichever scheme is active right now.
 */
export const colors: Palette = new Proxy({} as Palette, {
  get: (_target, key: string) => activePalette[key as keyof Palette],
  // Without these, spreading or Object.keys() over `colors` yields nothing,
  // which would silently produce empty styles rather than an error.
  has: (_target, key: string) => key in activePalette,
  ownKeys: () => Reflect.ownKeys(activePalette),
  getOwnPropertyDescriptor: (_target, key: string) => ({
    value: activePalette[key as keyof Palette],
    enumerable: true,
    configurable: true,
  }),
});

type NamedStyles<T> = StyleSheet.NamedStyles<T>;

/**
 * Drop-in replacement for `StyleSheet.create` whose definitions are re-resolved
 * when the palette changes. The thunk is invoked once per scheme and cached, so
 * a render costs one property read, not a stylesheet rebuild.
 */
export const themedStyles = <T extends NamedStyles<T>>(factory: () => T): T => {
  let cached: T | undefined;
  let cachedGeneration = -1;

  const resolve = (): T => {
    if (cached === undefined || cachedGeneration !== generation) {
      cached = StyleSheet.create(factory());
      cachedGeneration = generation;
    }
    return cached;
  };

  return new Proxy({} as T, {
    get: (_target, key: string) => resolve()[key as keyof T],
    has: (_target, key: string) => key in resolve(),
    ownKeys: () => Reflect.ownKeys(resolve() as object),
    getOwnPropertyDescriptor: (_target, key: string) => ({
      value: resolve()[key as keyof T],
      enumerable: true,
      configurable: true,
    }),
  });
};
