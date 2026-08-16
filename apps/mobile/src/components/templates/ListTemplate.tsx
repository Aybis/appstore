import type { ReactElement, ReactNode } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../constants/theme';

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
      renderItem={({ item }) => (
        <View style={styles.rowWrap}>{renderItem(item)}</View>
      )}
      ListHeaderComponent={header ? <>{header}</> : null}
      ListEmptyComponent={<>{empty}</>}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomInset + spacing.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
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

const styles = StyleSheet.create({
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
});
