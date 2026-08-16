import { ScrollView, StyleSheet } from 'react-native';
import { spacing } from '../../constants/theme';
import { Screenshot } from '../molecules';

type Props = {
  urls: readonly string[];
  itemWidth: number;
  itemHeight: number;
};

/** Snapping preview carousel on the detail screen. */
export const ScreenshotCarousel = ({ urls, itemWidth, itemHeight }: Props) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    snapToInterval={itemWidth + spacing.md}
    decelerationRate="fast"
    contentContainerStyle={styles.row}
  >
    {urls.map((url, index) => (
      <Screenshot
        key={url}
        url={url}
        index={index}
        width={itemWidth}
        height={itemHeight}
      />
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  row: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
});
