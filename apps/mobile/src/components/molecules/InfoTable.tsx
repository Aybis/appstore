import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

export type InfoEntry = {
  label: string;
  value: string;
};

type Props = { rows: readonly InfoEntry[] };

/**
 * Label/value table — used by both the detail and about screens. Rows sit in
 * one translucent panel and are separated by vertical rhythm rather than
 * hairlines, matching the rest of the app's stroke-free surfaces.
 */
export const InfoTable = ({ rows }: Props) => (
  <View style={styles.table}>
    {rows.map((row) => (
      <View key={row.label} style={styles.row}>
        <Text style={styles.label}>{row.label}</Text>
        <Text style={styles.value} numberOfLines={1}>
          {row.value}
        </Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  table: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textTertiary,
  },
  value: {
    ...typography.bodyStrong,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
});
