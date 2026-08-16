import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { Paragraph, Title } from '../atoms';
import { PagerDots } from '../molecules';

export type Slide = {
  key: string;
  title: string;
  body: string;
  /** Two-tone accent for the illustration block. */
  palette: readonly [string, string];
};

type Props = { slides: readonly Slide[] };

/** Horizontally paged intro shown to signed-out users. */
export const OnboardingCarousel = ({ slides }: Props) => {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {slides.map((slide) => (
          <View key={slide.key} style={[styles.slide, { width }]}>
            <View
              style={[styles.art, { backgroundColor: slide.palette[0] }]}
              accessibilityElementsHidden
            >
              <View
                style={[styles.artSheen, { backgroundColor: slide.palette[1] }]}
              />
              <Text style={styles.artMark}>
                {slide.title.slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <View style={styles.copy}>
              <Title style={styles.centered}>{slide.title}</Title>
              <Paragraph style={styles.centered}>{slide.body}</Paragraph>
            </View>
          </View>
        ))}
      </ScrollView>

      <PagerDots count={slides.length} activeIndex={index} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
  },
  slide: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
    alignItems: 'center',
  },
  art: {
    width: '100%',
    height: 220,
    borderRadius: radius.xl,
    overflow: 'hidden',
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
    fontSize: 76,
    fontWeight: '700',
    color: colors.textInverse,
    opacity: 0.95,
  },
  copy: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  centered: {
    textAlign: 'center',
  },
});
