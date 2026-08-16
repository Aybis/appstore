import { useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../src/components/molecules';
import { AppCard, CatalogHeader } from '../../src/components/organisms';
import { ListTemplate } from '../../src/components/templates';
import { useFeaturedApps, useSearch } from '../../src/hooks';
import { spacing } from '../../src/constants/theme';
import { sortApps, type SortKey } from '../../src/utils/sort';
import type { App, Category } from '../../src/types';

const MAX_FEATURED_CARD_WIDTH = 300;

/**
 * Discover / catalog page (BRD P1). Owns the filter state and the data hooks,
 * then hands finished content to ListTemplate.
 */
export default function DiscoverScreen() {
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

  const featuredApps = featured.data ?? [];
  const showFeatured = !search.active && !category && featuredApps.length > 0;

  const listHeading = search.active
    ? `Results for “${search.query.trim()}”`
    : category
      ? `${category} apps`
      : 'All apps';

  const empty = () => {
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
    <ListTemplate<App>
      data={apps}
      keyExtractor={(app) => app.id}
      renderItem={(app) => <AppCard app={app} />}
      header={
        <CatalogHeader
          query={search.query}
          onQueryChange={search.setQuery}
          category={category}
          // Tapping the active category clears it.
          onCategoryChange={(next) =>
            setCategory(next === category ? null : next)
          }
          sort={sort}
          onSortChange={setSort}
          featured={featuredApps}
          showFeatured={showFeatured}
          featuredCardWidth={Math.min(
            width - spacing.xl * 2,
            MAX_FEATURED_CARD_WIDTH,
          )}
          listHeading={listHeading}
          resultCount={search.loading ? null : apps.length}
        />
      }
      empty={empty()}
      refreshing={search.refreshing}
      onRefresh={() => {
        search.refresh();
        featured.refresh();
      }}
      bottomInset={insets.bottom}
    />
  );
}
