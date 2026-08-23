import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

import { colors, radius, spacing, themedStyles, typography } from '../../constants/theme';
import { spring } from '../../motion';
import { Button, Paragraph, Title } from '../atoms';
import type { ComponentType } from 'react';
import { PagerDots } from '../molecules';

export type Slide = {
  key: string;
  title: string;
  body: string;
  /** Two-tone accent for the illustration block. */
  palette: readonly [string, string];
  /**
   * The glyph drawn on the panel.
   *
   * Previously this was the first LETTER of the title, which rendered a giant
   * "Y" over the first slide and read as a placeholder somebody forgot to
   * replace. A slide's artwork should say something about the slide.
   */
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
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

  const frameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0.55, 1, 0.55], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollX.value, inputRange, [0.9, 1, 0.9], Extrapolation.CLAMP) },
    ],
  }));

  // Overscanned so the parallax translate never uncovers the frame's edge —
  // the frame itself clips it, this layer is just wider than what it clips.
  const parallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          inputRange,
          [PARALLAX, 0, -PARALLAX],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View style={[styles.artFrame, frameStyle]} accessibilityElementsHidden>
        <Animated.View style={[styles.art, parallaxStyle]}>
          <LinearGradient
            colors={[slide.palette[0], slide.palette[1]]}
            start={{ x: 0.08, y: 0 }}
            end={{ x: 0.95, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.artSheen, { backgroundColor: slide.palette[1] }]} />
          <View style={styles.artMark}>
            <slide.icon size={72} color={colors.onAccent} strokeWidth={1.5} />
          </View>
        </Animated.View>
      </Animated.View>

      <View style={styles.copy}>
        <Title style={styles.heading}>{slide.title}</Title>
        <Paragraph style={styles.centered}>{slide.body}</Paragraph>
      </View>
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
  artFrame: {
    width: '100%',
    height: 260,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceInset,
  },
  art: {
    // Overscans the frame on every side by PARALLAX so the translate above
    // never reveals a gap at the clipped edge.
    position: 'absolute',
    top: -PARALLAX,
    left: -PARALLAX,
    right: -PARALLAX,
    bottom: -PARALLAX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artSheen: {
    position: 'absolute',
    top: -60,
    right: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.5,
  },
  artMark: {
    opacity: 0.92,
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
