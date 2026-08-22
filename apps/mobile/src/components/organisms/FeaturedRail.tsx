import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

import { spacing } from '../../constants/theme';
import { SectionTitle } from '../atoms';
import { PagerDots } from '../molecules';
import { FeaturedCard } from './FeaturedCard';
import type { App } from '../../types';

type Props = {
  apps: readonly App[];
  cardWidth: number;
};

/** Snapping horizontal rail of featured apps (FR-1.6). */
export const FeaturedRail = ({ apps, cardWidth }: Props) => {
  const snapInterval = cardWidth + spacing.md;
  const scrollX = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // Drives both the per-card leave-centre scale/fade (read on the UI thread
  // via `scrollX` directly) and the dot indicator (bridged to JS state, since
  // PagerDots takes a plain index rather than a shared value).
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      const nextIndex = Math.round(event.contentOffset.x / snapInterval);
      const clamped = Math.max(0, Math.min(nextIndex, apps.length - 1));
      runOnJS(setActiveIndex)(clamped);
    },
  });

  return (
    <View style={styles.section}>
      <SectionTitle>Featured</SectionTitle>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        decelerationRate="fast"
        contentContainerStyle={styles.row}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {apps.map((app, index) => (
          <FeaturedCard
            key={app.id}
            app={app}
            width={cardWidth}
            index={index}
            scrollX={scrollX}
            snapInterval={snapInterval}
          />
        ))}
      </Animated.ScrollView>
      {apps.length > 1 && <PagerDots count={apps.length} activeIndex={activeIndex} />}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  row: {
    gap: spacing.md,
    paddingRight: spacing.xl,
    paddingBottom: spacing.xs,
  },
});
