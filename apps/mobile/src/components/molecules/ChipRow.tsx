import { ScrollView, StyleSheet } from 'react-native';
import { spacing } from '../../constants/theme';
import { Chip } from '../atoms';
import { FadeIn } from '../../motion';

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
 *
 * Padded on both ends so the first/last chip never sits flush with the
 * screen edge, even mid-scroll.
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
    {options.map((option, index) => (
      <FadeIn key={option.key} index={index}>
        <Chip
          label={option.label}
          selected={option.key === selectedKey}
          onPress={() => onSelect(option.key)}
        />
      </FadeIn>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
});
