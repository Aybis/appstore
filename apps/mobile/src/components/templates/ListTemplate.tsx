import type { ReactElement, ReactNode } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { colors, spacing, themedStyles } from '../../constants/theme';

/**
 * Row height including the gap below it: 56pt icon + 12pt padding top and
 * bottom, plus the 12pt list gap. Kept in step with AppCard's own padding —
 * a wrong value here shows up as scroll position drifting, not as a crash.
 */
const ROW_HEIGHT = 56 + spacing.md * 2 + spacing.md;
import { FadeIn } from '../../motion';

type Props<T> = {
  data: readonly T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactElement;
  header?: ReactNode;
  /** Shown in place of the rows when `data` is empty. */
  empty: ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  bottomInset: number;
};

/**
 * Scrolling list page skeleton: optional header block above pull-to-refresh
 * rows. Layout only — the page decides what a row is, so this template stays
 * free of any organism or domain import.
 */
export const ListTemplate = <T,>({
  data,
  keyExtractor,
  renderItem,
  header,
  empty,
  refreshing,
  onRefresh,
  bottomInset,
}: Props<T>) => (
  <View style={styles.screen}>
    <FlatList
      data={data as T[]}
      keyExtractor={keyExtractor}
      renderItem={({ item, index }) => (
        <FadeIn index={index} style={styles.rowWrap}>
          {renderItem(item)}
        </FadeIn>
      )}
      // Rows are a fixed height by construction (icon 56 + padding), so the
      // list can place them without measuring — which is what lets scrolling
      // stay smooth while cells are still being mounted.
      getItemLayout={(_, index) => ({
        length: ROW_HEIGHT,
        offset: ROW_HEIGHT * index,
        index,
      })}
      ListHeaderComponent={header ? <>{header}</> : null}
      ListEmptyComponent={<>{empty}</>}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomInset + spacing.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
      // Tuned for low-end hardware, which is the constraint this catalog has to
      // survive: every row carries a gradient icon and an animated pressable,
      // so the default window of 21 screens of rows is far more mounted view
      // than an old device can afford.
      removeClippedSubviews
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      updateCellsBatchingPeriod={60}
      windowSize={7}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    />
  </View>
);

const styles = themedStyles(() => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.md,
  },
  rowWrap: {
    paddingHorizontal: spacing.xl,
  },
}));
