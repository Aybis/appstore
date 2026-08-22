/**
 * The single most load-bearing interaction primitive in the app.
 *
 * A surface that springs down under a finger and back on release, with an
 * optional haptic tick. Used for every card, row, chip, button and icon target,
 * which is why the scale ratios live in `motion.ts` as named sizes rather than
 * being passed as numbers — consistency here is most of what "feels smooth"
 * actually means.
 *
 * Driven by Reanimated on the UI thread, so the press response survives a busy
 * JS thread: the catalog can be re-sorting and the card still tracks the finger.
 */

import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { haptics } from './haptics';
import { PRESS_SCALE, spring } from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type HapticKind = 'tap' | 'confirm' | 'select' | 'none';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Named target size, not a raw number — see PRESS_SCALE. */
  scaleTo?: keyof typeof PRESS_SCALE;
  /** Dim as well as shrink. For rows where scale alone is too subtle. */
  dimTo?: number;
  /** Which haptic to fire on press-in. 'none' for repeated/scrolling surfaces. */
  haptic?: HapticKind;
};

export const PressableScale = ({
  children,
  style,
  scaleTo = 'card',
  dimTo,
  haptic = 'tap',
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Props) => {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const target = PRESS_SCALE[scaleTo];
    return {
      transform: [{ scale: 1 - pressed.value * (1 - target) }],
      opacity: dimTo == null ? 1 : 1 - pressed.value * (1 - dimTo),
    };
  });

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        pressed.value = withSpring(1, spring.press);
        // Disabled targets still receive press events on Android; firing a tick
        // for a press that will do nothing teaches the wrong thing.
        if (!disabled && haptic !== 'none') haptics[haptic]();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withSpring(0, spring.press);
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
};
