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
  /**
   * Horizontal padding of the PARENT this row sits in.
   *
   * The row cancels it with a negative margin and re-applies it to its own
   * content, so chips scroll all the way to the screen edge while the first and
   * last still sit on the gutter. Without this the scroll viewport stops at the
   * parent's padding and the row reads as clipped mid-chip.
   */
  gutter?: number;
};

/**
 * Horizontally scrolling row of selectable chips. Generic over the key type so
 * the caller keeps its own union (category, sort key) instead of raw strings.
 *
 * Full-bleed by design: it escapes its parent's gutter so the row runs edge to
 * edge, then pads its own content back to the gutter. A chip scrolling past the
 * screen edge reads as "there is more"; a chip stopping 24px short reads as a
 * rendering bug.
 */
export const ChipRow = <K extends string>({
  options,
  selectedKey,
  onSelect,
  accessibilityLabel,
  gutter = spacing.xl,
}: Props<K>) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={{ marginHorizontal: -gutter }}
    contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}
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
    alignItems: 'center',
    gap: spacing.sm,
    // Vertical breathing room so a selected chip's ring is not flush against
    // the section above or below it.
    paddingVertical: spacing.xs,
  },
});
