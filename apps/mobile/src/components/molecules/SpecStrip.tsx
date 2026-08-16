import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

export type Spec = {
  label: string;
  value: string;
};

type Props = { specs: readonly Spec[] };

/** Divider-separated label/value cells shown under the detail hero. */
export const SpecStrip = ({ specs }: Props) => (
  <View style={styles.strip}>
    {specs.map((spec, index) => (
      <Fragment key={spec.label}>
        {index > 0 && <View style={styles.divider} />}
        <View style={styles.cell}>
          <Text style={styles.label}>{spec.label}</Text>
          <Text style={styles.value} numberOfLines={1}>
            {spec.value}
          </Text>
        </View>
      </Fragment>
    ))}
  </View>
);

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  label: {
    ...typography.label,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.6,
  },
  value: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.text,
  },
  divider: {
    width: 1,
    height: 26,
    backgroundColor: colors.border,
  },
});
