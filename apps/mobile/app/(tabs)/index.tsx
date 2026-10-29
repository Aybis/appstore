import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  HomeFeed,
} from '../../src/components/organisms';
import { ListTemplate } from '../../src/components/templates';
import { useFeaturedApps, useSearch } from '../../src/hooks';
import { useInstalls } from '../../src/services/install/InstallProvider';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/theme';
import { TAB_BAR_HEIGHT } from '../../src/theme/layout';
import { spacing } from '../../src/theme/tokens';
import { useUpdateNotifications } from '../../src/services/notifications/useUpdateNotifications';
import { sortApps, type SortKey } from '../../src/utils/sort';
import type { App, Category } from '../../src/types';

const MAX_FEATURED_CARD_WIDTH = 300;

/**
 * Module scope, not an inline arrow.
 *
 * FlatList re-renders its cells when keyExtractor changes identity, and an
 * arrow written at the call site is a new function on every render — which
 * quietly cancels the React.memo on AppCard that exists to prevent exactly
 * that. Same reasoning as ListTemplate's own memoisation.
 */
const appKey = (app: App): string => app.id;

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
  const { scheme } = useTheme();

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
  // Browse mode: nothing searched, no category picked — show the rails.
  const home = !search.active && !category;
  const showFeatured = home && featuredApps.length > 0;

  /*
   * Chips come from the catalog itself, and are remembered: picking a category
   * narrows `search.data` to that category, which would otherwise make every
   * other chip vanish the moment one was chosen.
   */
  const seenCategories = useRef<Set<Category>>(new Set());
  for (const app of search.data ?? []) seenCategories.current.add(app.category);
  const categories = [...seenCategories.current].sort();

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
    if (home && apps.length > 0) return <HomeFeed apps={apps} />;
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

  // Stable identities for everything handed to the list — see appKey above.
  const renderApp = useCallback(
    (app: App) => <AppCard app={app} onOpen={setSheetApp} />,
    [],
  );

  const onRefresh = useCallback(() => {
    search.refresh();
    featured.refresh();
  }, [search.refresh, featured.refresh]);

  const featuredCardWidth = Math.min(width - spacing.xl * 2, MAX_FEATURED_CARD_WIDTH);

  /*
   * `scheme` is in the dependency list on purpose, and it is not decoration.
   *
   * ThemeProvider passes `children` through by identity, so React only
   * re-renders context subscribers. This screen IS one — but a memoised JSX
   * element survives its own component re-rendering: React sees the identical
   * element object and skips the subtree beneath it. That is how the catalog
   * ended up painting dark-theme text onto a white page after a switch to
   * light, with the rows correct and everything above them a scheme behind.
   */
  const header = useMemo(
    () => (
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
          featuredCardWidth={featuredCardWidth}
          listHeading={listHeading}
          resultCount={search.loading ? null : apps.length}
          categories={categories.length > 0 ? categories : undefined}
          home={home}
        />
    ),
    [
      search.query,
      search.setQuery,
      search.loading,
      category,
      sort,
      featuredApps,
      showFeatured,
      featuredCardWidth,
      listHeading,
      apps.length,
      home,
      categories.join('|'),
      scheme,
    ],
  );

  return (
    <>
    <ListTemplate<App>
      // Browse mode renders its rails through `empty`, so the list itself stays empty.
      data={home ? [] : apps}
      keyExtractor={appKey}
      renderItem={renderApp}
      header={header}
      empty={empty()}
      refreshing={search.refreshing}
      onRefresh={onRefresh}
      bottomInset={insets.bottom + TAB_BAR_HEIGHT}
    />
    <AppDetailSheet app={sheetApp} onClose={() => setSheetApp(null)} />
    </>
  );
}
