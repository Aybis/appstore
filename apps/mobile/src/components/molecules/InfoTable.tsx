import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

export type InfoEntry = {
  label: string;
  value: string;
};

type Props = { rows: readonly InfoEntry[] };

/** Bordered label/value table — used by both the detail and about screens. */
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
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  value: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
});
