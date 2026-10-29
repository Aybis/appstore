/**
 * Automatic screen tracking, driven by the router rather than by call sites.
 *
 * The alternative — a `trackScreen` call at the top of every screen component —
 * is wrong in a way that only shows up months later: the screen somebody adds
 * next will not have one, and nobody will notice a hole in the funnel. Reading
 * the route means a new screen is tracked because it exists, not because
 * somebody remembered.
 */

import { useEffect, useRef } from 'react';
import { useSegments } from 'expo-router';

import { trackScreen } from './analytics';

/**
 * Turns router segments into a stable screen name.
 *
 * Two things are deliberately thrown away. Group segments — `(tabs)`, `(auth)`
 * — are layout structure the user never sees, and including them would rename
 * every screen the day the folders get reorganised. Dynamic segments keep their
 * PARAMETER NAME and drop the value: `/app/slack` and `/app/figma` both report
 * as `app_slug`. That is not only to keep cardinality down — a screen name is
 * retained analytics data, and the specific internal apps somebody browses is
 * not something to spray into it by accident.
 */
export const screenNameFrom = (segments: readonly string[]): string => {
  const parts = segments
    .filter((segment) => !segment.startsWith('('))
    .map((segment) => segment.replace(/^\[(?:\.\.\.)?(.+)\]$/, '$1'));

  return parts.length > 0 ? parts.join('_') : 'home';
};

/** Reports a screen view whenever the route changes. Mount once, at the root. */
export const useScreenTracking = (): void => {
  const segments = useSegments();
  const last = useRef<string | null>(null);

  useEffect(() => {
    const name = screenNameFrom(segments);

    // useSegments re-fires on re-render, not only on navigation. Without this
    // the same screen reports several times per visit and every per-screen
    // number in the console is inflated by an amount that varies by screen.
    if (name === last.current) return;
    last.current = name;

    trackScreen(name);
  }, [segments]);
};
