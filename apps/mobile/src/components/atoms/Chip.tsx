import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * Selectable pill. Content-agnostic on purpose — the catalog uses it for both
 * the category filter and the sort filter.
 */
export const Chip = ({ label, selected, onPress }: Props) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    style={({ pressed }) => [
      styles.chip,
      selected && styles.chipSelected,
      pressed && styles.chipPressed,
    ]}
  >
    <Text style={[styles.label, selected && styles.labelSelected]}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipPressed: {
    opacity: 0.7,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.textInverse,
  },
});
