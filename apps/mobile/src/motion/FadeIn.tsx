/**
 * Entrance animation for list rows and stacked sections.
 *
 * Deliberately NOT Reanimated's `FadeInDown.delay(...)` layout animation.
 * Layout animations re-run on every re-render that remounts a row, so a
 * catalog that re-sorts or refetches would replay the whole stagger and the
 * list would appear to flicker. This drives a mount-once shared value instead:
 * the entrance belongs to the row's lifetime, not to its render count.
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

type Props = {
  children: ReactNode;
  /** Position in the list. Drives the staggered delay; omit for no stagger. */
  index?: number;
  /** Extra delay on top of the stagger, for a section that follows a header. */
  delayMs?: number;
  /** Travel distance. 0 fades in place. */
  translateY?: number;
  style?: StyleProp<ViewStyle>;
};

export const FadeIn = ({
  children,
  index = 0,
  delayMs = 0,
  translateY = ENTER_TRANSLATE_Y,
  style,
}: Props) => {
  const progress = useSharedValue(0);
  const offset = useSharedValue(translateY);

  useEffect(() => {
    const delay = staggerFor(index) + delayMs;
    // Opacity is timed and offset springs: a spring on opacity can overshoot
    // past 1, which clips to no visible effect but wastes a frame budget on
    // every row, and a timed offset lacks the settle that makes it feel alive.
    progress.value = withDelay(delay, withTiming(1, timing.normal));
    offset.value = withDelay(delay, withSpring(0, spring.standard));
  }, [index, delayMs, progress, offset]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: offset.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
};
