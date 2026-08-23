import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, spacing } from '../../constants/theme';
import { spring } from '../../motion';

type Props = {
  count: number;
  activeIndex: number;
};

const DOT_SIZE = 7;
const ACTIVE_WIDTH = 22;
/**
 * Growth is driven by `scaleX`, not the `width` style — a dot that changes
 * layout width would fight the row's own reflow on every page change,
 * whereas a transform composites on the UI thread and leaves siblings alone.
 */
const ACTIVE_SCALE = ACTIVE_WIDTH / DOT_SIZE;

const Dot = ({ active }: { active: boolean }) => {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, spring.standard);
  }, [active, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.borderStrong, colors.accent],
    ),
    transform: [{ scaleX: interpolate(progress.value, [0, 1], [1, ACTIVE_SCALE]) }],
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
