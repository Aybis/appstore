/**
 * Entrance animation for list rows and stacked sections.
 *
 * Deliberately NOT Reanimated's `FadeInDown.delay(...)` layout animation.
 * Layout animations re-run on every re-render that remounts a row, so a
 * catalog that re-sorts or refetches would replay the whole stagger and the
 * list would appear to flicker. This drives a shared value instead: the
 * entrance belongs to the row's lifetime, not to its render count.
 *
 * It also replays when the screen is RETURNED TO, which is not the same thing
 * as re-rendering. Expo Router keeps a tab screen mounted after its first
 * visit, so a strictly mount-once entrance plays exactly once per launch —
 * every later visit renders the screen already settled, and the app feels
 * alive the first time and static forever after. Focus is a real arrival;
 * a re-render is not. See useFocusReplay.
 */

import { useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ENTER_TRANSLATE_Y, spring, staggerFor, timing } from './motion';
import { useFocusReplay } from './useFocusReplay';
import { useReducedMotion } from './useReducedMotion';

type Props = {
  children: ReactNode;
  /** Position in the list. Drives the staggered delay; omit for no stagger. */
  index?: number;
  /** Extra delay on top of the stagger, for a section that follows a header. */
  delayMs?: number;
  /** Travel distance. 0 fades in place. */
  translateY?: number;
  /**
   * Replay the entrance when the screen is returned to, not only on mount.
   *
   * On by default because the alternative is what shipped: the animation plays
   * on a screen's first visit and never again, so the app feels alive once and
   * flat afterwards. Turn it off for content that outlives a navigation — a
   * persistent header, or anything inside a sheet that would re-enter behind
   * the user while they are reading it.
   */
  replayOnFocus?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const FadeIn = ({
  children,
  index = 0,
  delayMs = 0,
  translateY = ENTER_TRANSLATE_Y,
  replayOnFocus = true,
  style,
}: Props) => {
  const reduced = useReducedMotion();
  const focusTick = useFocusReplay();
  // 0 while replay is off, so the effect below never re-runs for it.
  const replay = replayOnFocus ? focusTick : 0;
  // Start at the final state when motion is reduced, so the first frame is
  // already correct and no animation is ever scheduled.
  const progress = useSharedValue(reduced ? 1 : 0);
  const offset = useSharedValue(reduced ? 0 : translateY);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      offset.value = 0;
      return;
    }

    const delay = staggerFor(index) + delayMs;

    // Reset before animating. On a replay the values are already at their
    // resting state, and animating to a value something already holds is a
    // no-op — which is precisely how the missing-on-return bug would survive
    // subscribing to focus in the first place.
    progress.value = 0;
    offset.value = translateY;

    // Opacity is timed and offset springs: a spring on opacity can overshoot
    // past 1, which clips to no visible effect but wastes a frame budget on
    // every row, and a timed offset lacks the settle that makes it feel alive.
    progress.value = withDelay(delay, withTiming(1, timing.normal));
    offset.value = withDelay(delay, withSpring(0, spring.standard));
  }, [index, delayMs, translateY, progress, offset, reduced, replay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: offset.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
};
