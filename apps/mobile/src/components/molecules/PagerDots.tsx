
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, spacing } from '../../theme/tokens';
import { spring } from '../../motion';
import { getActivePalette } from '../../theme';

type Props = {
  count: number;
  activeIndex: number;
};

const DOT_SIZE = 7;
const ACTIVE_WIDTH = 22;

const Dot = ({ active }: { active: boolean }) => {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, spring.standard);
  }, [active, progress]);

  // Read the palette into a plain object HERE, in render, and use that inside the
  // animated style below. Reanimated copies whatever an animated style refers to
  // the first time it sees it, and `colors` is one long-lived proxy: the copy of
  // it made under the first theme was reused after a switch, so the fill kept the
  // old palette while the text (read at render time) took the new one.
  const palette = getActivePalette();

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [palette.borderStrong, palette.accent],
    ),
    // Real width, not scaleX: a scaled circle becomes an oval (the corner radius
    // stretches with it) and grows over its neighbours instead of pushing them.
    width: interpolate(progress.value, [0, 1], [DOT_SIZE, ACTIVE_WIDTH], Extrapolation.CLAMP),
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
};

/** Page indicator for the onboarding carousel. */
export const PagerDots = ({ count, activeIndex }: Props) => (
  <View style={styles.row} accessibilityRole="tablist">
    {Array.from({ length: count }, (_, index) => (
      <Dot key={index} active={index === activeIndex} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
