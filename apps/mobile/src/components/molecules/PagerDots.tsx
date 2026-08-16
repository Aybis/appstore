import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../constants/theme';

type Props = {
  count: number;
  activeIndex: number;
};

/** Page indicator for the onboarding carousel. */
export const PagerDots = ({ count, activeIndex }: Props) => (
  <View style={styles.row} accessibilityRole="tablist">
    {Array.from({ length: count }, (_, index) => (
      <View
        key={index}
        style={[styles.dot, index === activeIndex && styles.dotActive]}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.accent,
  },
});
