import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether to skip decorative motion.
 *
 * Two audiences, one switch. People who turn "reduce motion" on in the OS mean
 * it, and older or low-end hardware pays a real cost for spring animations on
 * every row — a catalog of animated cards is the most expensive screen in this
 * app. Both are served by dropping straight to the final state.
 *
 * Read once and subscribed, not polled: the OS emits a change event, and asking
 * per render would put a bridge call in the hot path this exists to protect.
 */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return reduced;
};
