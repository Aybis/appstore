import { ScrollView, StyleSheet, View } from 'react-native';
import { spacing } from '../../constants/theme';
import { SectionTitle } from '../atoms';
import { FeaturedCard } from './FeaturedCard';
import type { App } from '../../types';

type Props = {
  apps: readonly App[];
  cardWidth: number;
};

/** Snapping horizontal rail of featured apps (FR-1.6). */
export const FeaturedRail = ({ apps, cardWidth }: Props) => (
  <View style={styles.section}>
    <SectionTitle>Featured</SectionTitle>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + spacing.md}
      decelerationRate="fast"
      contentContainerStyle={styles.row}
    >
      {apps.map((app) => (
        <FeaturedCard key={app.id} app={app} width={cardWidth} />
      ))}
    </ScrollView>
  </View>
);

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
