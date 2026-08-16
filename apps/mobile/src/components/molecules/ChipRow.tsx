import { ScrollView, StyleSheet } from 'react-native';
import { spacing } from '../../constants/theme';
import { Chip } from '../atoms';

export type ChipOption<K extends string> = {
  key: K;
  label: string;
};

type Props<K extends string> = {
  options: readonly ChipOption<K>[];
  selectedKey: K;
  onSelect: (key: K) => void;
  accessibilityLabel?: string;
};

/**
 * Horizontally scrolling row of selectable chips. Generic over the key type so
 * the caller keeps its own union (category, sort key) instead of raw strings.
 */
export const ChipRow = <K extends string>({
  options,
  selectedKey,
  onSelect,
  accessibilityLabel,
}: Props<K>) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.row}
    accessibilityLabel={accessibilityLabel}
  >
    {options.map((option) => (
      <Chip
        key={option.key}
        label={option.label}
        selected={option.key === selectedKey}
        onPress={() => onSelect(option.key)}
      />
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
});
