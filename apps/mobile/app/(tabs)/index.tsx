import { useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../src/components/molecules';
import {
  AppCard,
  AppDetailSheet,
  CatalogHeader,
} from '../../src/components/organisms';
import { ListTemplate } from '../../src/components/templates';
import { useFeaturedApps, useSearch } from '../../src/hooks';
import { useInstalls } from '../../src/install/InstallProvider';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/theme';
import { TAB_BAR_HEIGHT } from '../../src/constants/layout';
import { spacing } from '../../src/constants/theme';
import { useUpdateNotifications } from '../../src/notifications/useUpdateNotifications';
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
  const t = useT();
  // Subscribes this screen to the palette so a theme change re-renders it,
  // and through it everything it renders. See ThemeProvider.
  useTheme();

  const [category, setCategory] = useState<Category | null>(null);
  const [sort, setSort] = useState<SortKey>('name');
  // Set when an installed, up-to-date app is opened from a row.
  const [sheetApp, setSheetApp] = useState<App | null>(null);

  const search = useSearch(category);
  const featured = useFeaturedApps();

  const apps = useMemo(
    () => (search.data ? sortApps(search.data, sort) : []),
    [search.data, sort],
  );

  // Announces newer builds for anything already installed on this device.
  useUpdateNotifications(apps);

  // One OS query per catalog load, so every card's Install/Update/Open state
  // reflects what is actually on the device rather than only what MAYA
  // installed. Keyed by the package ids so it re-runs when the catalog does.
  const { syncDevice } = useInstalls();
  const packageIds = useMemo(
    () => apps.map((app) => app.packageId).filter(Boolean),
    [apps],
  );
  useEffect(() => syncDevice(packageIds), [syncDevice, packageIds]);

  const featuredApps = featured.data ?? [];
  const showFeatured = !search.active && !category && featuredApps.length > 0;

  const listHeading = search.active
    ? t('discover.resultsFor', { query: search.query.trim() })
    : category
      ? t('discover.categoryApps', { category })
      : t('discover.allApps');

  const empty = () => {
    if (search.loading) return <LoadingState />;
    if (search.error) {
      return <ErrorState error={search.error} onRetry={search.refresh} />;
    }
    return search.active ? (
      <EmptyState
        title={t('state.noMatches.title')}
        body={t('state.noMatches.body', { query: search.query.trim() })}
      />
    ) : (
      <EmptyState
        title={t('state.emptyCatalog.title')}
        body={t('state.emptyCatalog.body')}
      />
    );
  };

  return (
    <>
    <ListTemplate<App>
      data={apps}
      keyExtractor={(app) => app.id}
      renderItem={(app) => <AppCard app={app} onOpen={setSheetApp} />}
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
      bottomInset={insets.bottom + TAB_BAR_HEIGHT}
    />
    <AppDetailSheet app={sheetApp} onClose={() => setSheetApp(null)} />
    </>
  );
}
