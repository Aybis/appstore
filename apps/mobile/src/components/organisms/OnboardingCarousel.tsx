import { useState, type ComponentType } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { spacing, themedStyles, typography } from '../../constants/theme';
import { useT } from '../../i18n';
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
  /** Fires when the primary action is pressed on the final slide. */
  onComplete: () => void;
  /** Lets the screen react to paging — hiding Skip on the last slide. */
  onIndexChange?: (index: number) => void;
};

/** How far the art drifts opposite the swipe, in px, for the parallax read. */
const PARALLAX = 36;

/**
 * The art box, identical on every slide but sized to the device.
 *
 * Identical across slides so the heading underneath keeps one baseline through
 * the whole pager — each drawing fits itself inside this box, so a wide one and
 * a tall one occupy exactly the same vertical space.
 *
 * Sized to the window rather than fixed because a constant that looks right on
 * a 5" phone leaves a tall one looking like the artwork was dropped in the
 * middle of an empty page. The clamps stop it from getting silly in either
 * direction on a tablet or a very short screen.
 */
const ART_RATIO = 0.34;
const ART_MIN = 190;
const ART_MAX = 320;

const artHeightFor = (windowHeight: number): number =>
  Math.min(ART_MAX, Math.max(ART_MIN, windowHeight * ART_RATIO));

type SlidePanelProps = {
  slide: Slide;
  index: number;
  width: number;
  artHeight: number;
  scrollX: SharedValue<number>;
};

/**
 * One paged panel. Split out from the `.map` in the parent so each instance
 * calls its animated-style hooks at its own top level rather than inside a
 * loop, and so the parallax math only has to reason about its own index.
 */
const SlidePanel = ({ slide, index, width, artHeight, scrollX }: SlidePanelProps) => {
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
      <Animated.View style={[styles.art, { height: artHeight }, artStyle]} accessibilityElementsHidden>
        <Illustration width={artWidth} height={artHeight} />
      </Animated.View>

      <Animated.View style={[styles.copy, copyStyle]}>
        <Title style={styles.heading}>{slide.title}</Title>
        <Paragraph style={styles.centered}>{slide.body}</Paragraph>
      </Animated.View>
    </View>
  );
};

/** Horizontally paged intro shown to signed-out users. */
export const OnboardingCarousel = ({ slides, onComplete, onIndexChange }: Props) => {
  const { width, height } = useWindowDimensions();
  const artHeight = artHeightFor(height);
  const [index, setIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const activePage = useSharedValue(0);
  const scroller = useAnimatedRef<Animated.ScrollView>();
  const t = useT();

  const setPage = (next: number): void => {
    setIndex(next);
    onIndexChange?.(next);
  };

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
    const next = Math.round(event.contentOffset.x / width);
    if (next !== activePage.value) {
      activePage.value = next;
      runOnJS(setPage)(next);
    }
  });

  const isLast = index === slides.length - 1;

  /*
   * Next drives the same scroll a swipe does, rather than setting the index
   * directly. The parallax reads from the scroll offset, so moving the page
   * without moving the offset would leave the artwork behind and let the two
   * ways of advancing disagree about where the carousel is.
   */
  const advance = (): void => {
    if (isLast) {
      onComplete();
      return;
    }
    scroller.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scroller}
        style={styles.scroller}
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
            artHeight={artHeight}
            scrollX={scrollX}
          />
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          <PagerDots count={slides.length} activeIndex={index} />
        </View>
        <Button label={isLast ? t('onboarding.start') : t('onboarding.next')} onPress={advance} />
      </View>
    </View>
  );
};

const styles = themedStyles(() => ({
  container: {
    // Fills the space it is given rather than hugging its content. Hugging
    // left the pager floating in the middle of the screen with dead space
    // above the art and below the button, which is not a composition, it is
    // what happens when nothing claims the room.
    flex: 1,
    gap: spacing.xl,
  },
  scroller: {
    flex: 1,
  },
  slide: {
    // Children of a horizontal ScrollView stretch to the content container's
    // height, so each page fills the scroller and centres its own contents.
    justifyContent: 'center',
    gap: spacing.xl,
  },
  art: {
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
    alignItems: 'stretch',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  dots: {
    alignItems: 'center',
  },
}));
