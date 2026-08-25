import { useEffect, useState, type ComponentType } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { spacing, themedStyles, typography } from '../../constants/theme';
import { spring } from '../../motion';
import type { IllustrationProps } from '../illustrations';
import { Button, Paragraph, Title } from '../atoms';
import { PagerDots } from '../molecules';

export type Slide = {
  key: string;
  title: string;
  body: string;
  /**
   * The drawing for this slide.
   *
   * This replaced a gradient panel with a single line glyph on it. The glyph
   * before that was the first LETTER of the title, which rendered a giant "Y"
   * over the first slide. Both read as artwork somebody had not got to yet —
   * a slide's art should say something about the slide.
   */
  illustration: ComponentType<IllustrationProps>;
};

type Props = {
  slides: readonly Slide[];
  /**
   * Fires when the primary action on the final slide is pressed. Optional —
   * omit it to render the carousel with only the pager dots, unchanged.
   */
  onComplete?: () => void;
};

/** How far the art drifts opposite the swipe, in px, for the parallax read. */
const PARALLAX = 36;

/**
 * The art box, identical on every slide.
 *
 * Constant rather than per-illustration so the heading underneath keeps one
 * baseline across the whole pager. Each drawing fits itself inside this box,
 * so a wide one and a tall one both occupy exactly this much vertical space.
 */
const ART_HEIGHT = 248;

type SlidePanelProps = {
  slide: Slide;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
};

/**
 * One paged panel. Split out from the `.map` in the parent so each instance
 * calls its animated-style hooks at its own top level rather than inside a
 * loop, and so the parallax math only has to reason about its own index.
 */
const SlidePanel = ({ slide, index, width, scrollX }: SlidePanelProps) => {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  const Illustration = slide.illustration;

  /*
   * The drawing carries both the drift and the depth cue. It used to sit in a
   * clipped, overscanned frame because a gradient panel had edges that the
   * drift could expose; artwork on the page background has no edges to expose,
   * so the clip, the overscan and the frame all went with it.
   */
  const artStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          inputRange,
          [PARALLAX, 0, -PARALLAX],
          Extrapolation.CLAMP,
        ),
      },
      { scale: interpolate(scrollX.value, inputRange, [0.88, 1, 0.88], Extrapolation.CLAMP) },
    ],
  }));

  // The copy trails the art rather than moving with it: a shorter drift and a
  // later fade is what separates the two planes and makes the parallax read.
  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          inputRange,
          [PARALLAX / 3, 0, -PARALLAX / 3],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const artWidth = width - spacing.xl * 2;

  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View style={[styles.art, artStyle]} accessibilityElementsHidden>
        <Illustration width={artWidth} height={ART_HEIGHT} />
      </Animated.View>

      <Animated.View style={[styles.copy, copyStyle]}>
        <Title style={styles.heading}>{slide.title}</Title>
        <Paragraph style={styles.centered}>{slide.body}</Paragraph>
      </Animated.View>
    </View>
  );
};

/** Horizontally paged intro shown to signed-out users. */
export const OnboardingCarousel = ({ slides, onComplete }: Props) => {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const activePage = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
    const next = Math.round(event.contentOffset.x / width);
    if (next !== activePage.value) {
      activePage.value = next;
      runOnJS(setIndex)(next);
    }
  });

  const isLast = index === slides.length - 1;
  const ctaProgress = useSharedValue(0);

  useEffect(() => {
    ctaProgress.value = withSpring(isLast ? 1 : 0, spring.bouncy);
  }, [isLast, ctaProgress]);

  const dotsStyle = useAnimatedStyle(() => ({
    opacity: 1 - ctaProgress.value,
    transform: [{ scale: interpolate(ctaProgress.value, [0, 1], [1, 0.85]) }],
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaProgress.value,
    transform: [{ scale: interpolate(ctaProgress.value, [0, 1], [0.75, 1]) }],
  }));

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {slides.map((slide, slideIndex) => (
          <SlidePanel
            key={slide.key}
            slide={slide}
            index={slideIndex}
            width={width}
            scrollX={scrollX}
          />
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <Animated.View style={onComplete ? dotsStyle : undefined}>
          <PagerDots count={slides.length} activeIndex={index} />
        </Animated.View>

        {onComplete && (
          <Animated.View
            style={[styles.ctaWrap, ctaStyle]}
            pointerEvents={isLast ? 'auto' : 'none'}
          >
            <Button label="Get started" onPress={onComplete} />
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = themedStyles(() => ({
  container: {
    gap: spacing.xl,
  },
  slide: {
    gap: spacing.xl,
  },
  art: {
    height: ART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: spacing.sm,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  heading: {
    ...typography.display,
    lineHeight: Math.round(typography.display.fontSize * 1.15),
    textAlign: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  footer: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaWrap: {
    position: 'absolute',
    width: '100%',
    paddingHorizontal: spacing.xl,
  },
}));
