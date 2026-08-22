import { StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { spacing } from '../../constants/theme';
import { Screenshot } from '../molecules';

type Props = {
  urls: readonly string[];
  itemWidth: number;
  itemHeight: number;
};

/**
 * Max drift a shot gets relative to the scroll it rides on — a few pixels of
 * depth as it crosses the viewport, not a slide of its own.
 */
const PARALLAX_RANGE = 14;

/** Snapping preview carousel on the detail screen. */
export const ScreenshotCarousel = ({ urls, itemWidth, itemHeight }: Props) => {
  const scrollX = useSharedValue(0);
  const step = itemWidth + spacing.md;

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      contentContainerStyle={styles.row}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {urls.map((url, index) => (
        <ParallaxShot
          key={url}
          url={url}
          index={index}
          width={itemWidth}
          height={itemHeight}
          step={step}
          scrollX={scrollX}
        />
      ))}
    </Animated.ScrollView>
  );
};

type ShotProps = {
  url: string;
  index: number;
  width: number;
  height: number;
  step: number;
  scrollX: SharedValue<number>;
};

/**
 * Wraps `Screenshot` (owned by another slice) rather than modifying it: the
 * parallax is a transform applied from outside, computed from how far this
 * item's own snap position sits from the current scroll offset.
 */
const ParallaxShot = ({ url, index, width, height, step, scrollX }: ShotProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    const relative = scrollX.value - index * step;
    const translateX = interpolate(
      relative,
      [-step, 0, step],
      [-PARALLAX_RANGE, 0, PARALLAX_RANGE],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateX }] };
  });

  return (
    <Animated.View style={animatedStyle}>
      <Screenshot url={url} index={index} width={width} height={height} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
});
