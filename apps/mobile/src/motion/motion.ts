/**
 * Motion tokens.
 *
 * Everything springs; nothing eases. A spring carries velocity through the
 * gesture that caused it, which is the difference between an interface that
 * responds and one that plays an animation at you. Durations appear only where
 * there is no gesture to inherit from — a skeleton shimmer, a scrim fade.
 *
 * `damping`/`stiffness` are tuned so that press feedback settles inside a
 * finger-down (~120ms) and layout entrances settle just under a beat (~380ms).
 */

import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

export const spring = {
  /** Press-down / press-up. Fast, barely any overshoot. */
  press: { damping: 22, stiffness: 420, mass: 0.55 } satisfies WithSpringConfig,
  /** The default for anything entering or moving. A little life at the end. */
  standard: { damping: 18, stiffness: 220, mass: 0.9 } satisfies WithSpringConfig,
  /** Bottom sheets and large panels — heavier, no visible bounce. */
  sheet: { damping: 26, stiffness: 240, mass: 1.1 } satisfies WithSpringConfig,
  /** Deliberately springy. For success ticks and the install checkmark. */
  bouncy: { damping: 11, stiffness: 260, mass: 0.8 } satisfies WithSpringConfig,
} as const;

export const timing = {
  fast: { duration: 140, easing: Easing.out(Easing.quad) } satisfies WithTimingConfig,
  normal: { duration: 240, easing: Easing.out(Easing.cubic) } satisfies WithTimingConfig,
  slow: { duration: 420, easing: Easing.out(Easing.cubic) } satisfies WithTimingConfig,
} as const;

/** How far a list item travels while fading in. */
export const ENTER_TRANSLATE_Y = 14;

/**
 * Per-item delay in a staggered list.
 *
 * Capped by `staggerFor`, not left to multiply: at 40ms a 30-item list would
 * make the last row appear 1.2s after the first, which reads as jank rather
 * than choreography.
 */
export const STAGGER_STEP_MS = 38;
const STAGGER_MAX_ITEMS = 8;

export const staggerFor = (index: number): number =>
  Math.min(index, STAGGER_MAX_ITEMS) * STAGGER_STEP_MS;

/** Scale a surface shrinks to while held. */
export const PRESS_SCALE = {
  /** Cards and list rows — large targets need a smaller ratio to read. */
  card: 0.975,
  /** Buttons and chips. */
  control: 0.94,
  /** Icon-sized targets, where a small ratio would be invisible. */
  icon: 0.88,
} as const;
