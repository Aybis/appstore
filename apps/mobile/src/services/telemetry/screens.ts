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
import { AppState } from 'react-native';
import { useSegments } from 'expo-router';

import { track, trackScreen } from './analytics';

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

/** Ignore flicks through a screen: under this is navigation, not reading. */
const MIN_REPORTED_MS = 500;

/**
 * Reports a screen view whenever the route changes, and how long the previous
 * screen was actually looked at (`screen_time`).
 *
 * Time only counts while the app is in the foreground. A phone left on the
 * detail screen overnight would otherwise report eight hours of "engagement":
 * the clock stops when the app goes to the background and resumes when it
 * returns, and the open interval is flushed so it is not lost if the OS then
 * kills the process.
 */
export const useScreenTracking = (): void => {
  const segments = useSegments();
  const last = useRef<string | null>(null);
  // When the current foreground stretch on `last` began, or null while backgrounded.
  const since = useRef<number | null>(null);
  const accrued = useRef(0);

  const flush = (): void => {
    if (!last.current) return;
    const total = accrued.current + (since.current ? Date.now() - since.current : 0);
    accrued.current = 0;
    since.current = since.current ? Date.now() : null;
    if (total >= MIN_REPORTED_MS) {
      track('screen_time', { screen_name: last.current, duration_s: Math.round(total / 100) / 10 });
    }
  };

  useEffect(() => {
    since.current = Date.now();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        since.current = Date.now();
      } else {
        flush();
        since.current = null;
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const name = screenNameFrom(segments);

    // useSegments re-fires on re-render, not only on navigation. Without this
    // the same screen reports several times per visit and every per-screen
    // number in the console is inflated by an amount that varies by screen.
    if (name === last.current) return;
    flush();
    last.current = name;
    accrued.current = 0;
    since.current = AppState.currentState === 'active' ? Date.now() : null;

    trackScreen(name);
  }, [segments]);
};
