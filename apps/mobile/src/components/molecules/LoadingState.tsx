import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing, themedStyles } from '../../constants/theme';
import { FadeIn, Shimmer } from '../../motion';

type Props = {
  /** Announced to screen readers — the shimmer itself has nothing to read. */
  label?: string;
  /** Placeholder rows to draw, staggered in. */
  count?: number;
};

const ROW_ICON = 56;
const BUTTON_WIDTH = 82;

/**
 * Skeleton in the exact shape of a catalog row — icon square, two text
 * lines, action pill — so the list appears to already be there and is just
 * settling in, rather than replacing a spinner with content.
 */
export const LoadingState = ({ label = 'Loading apps…', count = 6 }: Props) => (
  <View style={styles.list} accessible accessibilityLabel={label}>
    {Array.from({ length: count }, (_, index) => (
      <FadeIn key={index} index={index}>
        <View style={styles.row}>
          <Shimmer width={ROW_ICON} height={ROW_ICON} borderRadius={radius.lg} />
          <View style={styles.body}>
            <Shimmer width="58%" height={15} />
            <Shimmer width="36%" height={12} />
          </View>
          <Shimmer width={BUTTON_WIDTH} height={34} borderRadius={radius.pill} />
        </View>
      </FadeIn>
    ))}
  </View>
);

const styles = themedStyles(() => ({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  body: {
    flex: 1,
    gap: spacing.sm,
  },
}));
