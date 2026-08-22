import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles, typography } from '../../constants/theme';

export type Spec = {
  label: string;
  value: string;
};

type Props = { specs: readonly Spec[] };

/**
 * Label/value cells shown under the detail hero, in one translucent panel.
 * Columns are separated by even flex spacing rather than divider lines —
 * depth here comes from the surface fill, not a stroke.
 */
export const SpecStrip = ({ specs }: Props) => (
  <View style={styles.strip}>
    {specs.map((spec) => (
      <View key={spec.label} style={styles.cell}>
        <Text style={styles.label}>{spec.label}</Text>
        <Text style={styles.value} numberOfLines={1}>
          {spec.value}
        </Text>
      </View>
    ))}
  </View>
);

const styles = themedStyles(() => ({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.6,
  },
  value: {
    ...typography.bodyStrong,
    color: colors.text,
  },
}));
