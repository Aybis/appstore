import { useCallback, useMemo, type ReactElement, type ReactNode } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { colors, spacing, themedStyles } from '../../constants/theme';

/**
 * Row height including the gap below it: 56pt icon + 12pt padding top and
 * bottom, plus the 12pt list gap. Kept in step with AppCard's own padding —
 * a wrong value here shows up as scroll position drifting, not as a crash.
 */
const ROW_HEIGHT = 56 + spacing.md * 2 + spacing.md;
import { FadeIn } from '../../motion';

/**
 * Hoisted out of the component because it is pure and depends on nothing.
 *
 * Declared inline it would be a new function on every render, and FlatList
 * treats a changed getItemLayout as a reason to recompute — on the exact
 * hardware this list exists to stay smooth on.
 */
const itemLayout = (_: unknown, index: number) => ({
  length: ROW_HEIGHT,
  offset: ROW_HEIGHT * index,
  index,
});

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
}: Props<T>) => {
  /*
   * EVERYTHING BELOW IS MEMOISED ON PURPOSE.
   *
   * AppCard is wrapped in React.memo so that a catalog re-render does not
   * re-render every visible row. That only works if the props FlatList
   * receives are stable too: an inline renderItem, a fresh <RefreshControl>
   * element, and an array literal for contentContainerStyle are all new
   * identities on every render, and each one is enough to make FlatList
   * re-render its cells anyway. The memo upstairs was being paid for and not
   * collected.
   *
   * This is the difference between smooth and nearly-smooth on an older phone,
   * where the cost lands as dropped frames during a flick rather than as
   * anything visible while idle.
   */
  const row = useCallback(
    ({ item, index }: ListRenderItemInfo<T>) => (
      <FadeIn index={index} style={styles.rowWrap}>
        {renderItem(item)}
      </FadeIn>
    ),
    [renderItem],
  );

  const contentStyle = useMemo(
    () => [styles.content, { paddingBottom: bottomInset + spacing.xxl }],
    [bottomInset],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={colors.accent}
        colors={[colors.accent]}
      />
    ),
    [refreshing, onRefresh],
  );

  const headerElement = useMemo(() => (header ? <>{header}</> : null), [header]);
  const emptyElement = useMemo(() => <>{empty}</>, [empty]);

  return (
  <View style={styles.screen}>
    <FlatList
      data={data as T[]}
      keyExtractor={keyExtractor}
      renderItem={row}
      // Rows are a fixed height by construction (icon 56 + padding), so the
      // list can place them without measuring — which is what lets scrolling
      // stay smooth while cells are still being mounted.
      getItemLayout={itemLayout}
      ListHeaderComponent={headerElement}
      ListEmptyComponent={emptyElement}
      contentContainerStyle={contentStyle}
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
      refreshControl={refreshControl}
    />
  </View>
  );
};

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
