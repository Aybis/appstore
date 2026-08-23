import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * A counter that ticks each time the containing screen regains focus.
 *
 * Exists because of a bug that only shows up on the second visit. Expo Router
 * keeps a tab screen MOUNTED once you have been there, so a mount-triggered
 * entrance plays exactly once per app launch: go to My Apps, back to Discover,
 * return to My Apps, and the stagger is simply gone. The screen looks static in
 * a way the first visit never did, and nothing in the code looks wrong — the
 * effect fired, once, correctly.
 *
 * The tick starts at 0 and the first focus is skipped, so mounting and focusing
 * together do not run the entrance twice. Only a genuine RETURN advances it.
 */
export const useFocusReplay = (): number => {
  const [tick, setTick] = useState(0);

  useFocusEffect(
    // Wrapped in useCallback per useFocusEffect's contract: an unstable
    // callback re-runs the effect on every render, which here would restart
    // the entrance animation continuously. useInstalledApps.ts hit exactly
    // that and left a note about it.
    useCallback(() => {
      // The updater form matters: two screens focusing in the same tick would
      // otherwise both read the same stale value and only advance once.
      setTick((current) => current + 1);
    }, []),
  );

  // The mount focus fires immediately, so 1 is the initial state rather than a
  // replay. Reporting 0 for it keeps FadeIn's effect from running twice on the
  // first visit — once for mount, once for focus.
  return Math.max(0, tick - 1);
};
