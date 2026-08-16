import { useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppCard,
  CategoryChip,
  EmptyState,
  ErrorState,
  FeaturedCard,
  LoadingState,
  SearchBar,
} from '../src/components';
import { useFeaturedApps, useSearch } from '../src/hooks';
import { colors, spacing, typography } from '../src/constants/theme';
import { CATEGORIES, type App, type Category } from '../src/types';

type SortKey = 'name' | 'recent' | 'rating';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'A–Z' },
  { key: 'recent', label: 'Recently updated' },
  { key: 'rating', label: 'Top rated' },
];

const sortApps = (apps: App[], sort: SortKey): App[] =>
  [...apps].sort((a, b) => {
    if (sort === 'recent') return b.updatedAt.localeCompare(a.updatedAt);
    if (sort === 'rating') return b.rating - a.rating;
    return a.name.localeCompare(b.name);
  });

/**
 * Catalog / discovery screen (BRD P1).
 * Search, category filter, sort, featured rail, and the full app list — all
 * fed by the AppStoreClient via hooks.
 */
export default function CatalogScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState<Category | null>(null);
  const [sort, setSort] = useState<SortKey>('name');

  const search = useSearch(category);
  const featured = useFeaturedApps();

  const apps = useMemo(
    () => (search.data ? sortApps(search.data, sort) : []),
    [search.data, sort],
  );

  const featuredWidth = Math.min(width - spacing.xl * 2, 300);
  const showFeaturedRail =
    !search.active && !category && (featured.data?.length ?? 0) > 0;

  const header = (
    <View style={styles.header}>
      <Text style={styles.greeting}>Internal apps</Text>
      <Text style={styles.subtitle}>
        Company-approved builds for Android and iOS.
      </Text>

      <SearchBar value={search.query} onChangeText={search.setQuery} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <CategoryChip
          label="All"
          selected={category === null}
          onPress={() => setCategory(null)}
        />
        {CATEGORIES.map((item) => (
          <CategoryChip
            key={item}
            label={item}
            selected={category === item}
            onPress={() => setCategory(category === item ? null : item)}
          />
        ))}
      </ScrollView>

      {showFeaturedRail && (
        <View style={styles.featuredSection}>
          <Text style={styles.sectionTitle}>Featured</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={featuredWidth + spacing.md}
            decelerationRate="fast"
            contentContainerStyle={styles.featuredRow}
          >
            {featured.data?.map((app) => (
              <FeaturedCard key={app.id} app={app} width={featuredWidth} />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.listHeading}>
        <Text style={styles.sectionTitle}>
          {search.active
            ? `Results for “${search.query.trim()}”`
            : category
              ? `${category} apps`
              : 'All apps'}
        </Text>
        {!search.loading && (
          <Text style={styles.count}>
            {apps.length} {apps.length === 1 ? 'app' : 'apps'}
          </Text>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {SORTS.map((option) => (
          <CategoryChip
            key={option.key}
            label={option.label}
            selected={sort === option.key}
            onPress={() => setSort(option.key)}
          />
        ))}
      </ScrollView>
    </View>
  );

  const body = () => {
    if (search.loading) return <LoadingState />;
    if (search.error) {
      return <ErrorState error={search.error} onRetry={search.refresh} />;
    }
    return search.active ? (
      <EmptyState
        title="No matches"
        body={`Nothing matches “${search.query.trim()}”. Try a shorter term.`}
      />
    ) : (
      <EmptyState
        title="Catalog is empty"
        body="No published apps yet. Publishers can upload builds from the web console."
      />
    );
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={apps}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <AppCard app={item} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={body}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={search.refreshing}
            onRefresh={() => {
              search.refresh();
              featured.refresh();
            }}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    gap: spacing.md,
  },
  cardWrap: {
    paddingHorizontal: spacing.xl,
  },
  header: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  greeting: {
    ...typography.display,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: -spacing.md,
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  featuredSection: {
    gap: spacing.md,
  },
  featuredRow: {
    gap: spacing.md,
    paddingRight: spacing.xl,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  count: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
