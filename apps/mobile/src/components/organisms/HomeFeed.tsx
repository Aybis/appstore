import { useMemo } from 'react';
import { View } from 'react-native';

import { spacing, themedStyles } from '../../theme/tokens';
import { useT } from '../../i18n';
import { useInstalls } from '../../services/install/InstallProvider';
import { AppRail } from './AppRail';
import { PosterCard } from './PosterCard';
import { RankCard } from './RankCard';
import type { App } from '../../types';

const RAIL_SIZE = 10;
const MAX_CATEGORY_RAILS = 4;

const byRating = (a: App, b: App) => b.rating - a.rating || b.ratingCount - a.ratingCount;
const byUpdated = (a: App, b: App) => b.updatedAt.localeCompare(a.updatedAt);
const appKey = (app: App) => app.id;

type Props = {
  apps: readonly App[];
};

/**
 * The browse-mode home: rails built from the one catalog fetch, so there is no
 * extra request and nothing for the API to learn. Ranking and "recommended"
 * are deliberately simple and explainable — rating for Top, and for
 * Recommended: apps you do not have yet, favouring the categories of the ones
 * you do.
 */
export const HomeFeed = ({ apps }: Props) => {
  const t = useT();
  const { installedVersionFor } = useInstalls();

  const rails = useMemo(() => {
    const top = [...apps].sort(byRating).slice(0, RAIL_SIZE);

    const installedCategories = new Set(
      apps.filter((app) => installedVersionFor(app.slug)).map((app) => app.category),
    );
    const recommended = apps
      .filter((app) => !installedVersionFor(app.slug))
      .map((app) => ({ app, score: app.rating + (installedCategories.has(app.category) ? 2 : 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, RAIL_SIZE)
      .map((entry) => entry.app);

    const recent = [...apps].sort(byUpdated).slice(0, RAIL_SIZE);

    const byCategory = new Map<string, App[]>();
    for (const app of apps) byCategory.set(app.category, [...(byCategory.get(app.category) ?? []), app]);
    const categories = [...byCategory.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, MAX_CATEGORY_RAILS)
      .map(([name, list]) => ({ name, list: list.sort(byRating) }));

    return { top, recommended, recent, categories };
  }, [apps, installedVersionFor]);

  return (
    <View style={styles.feed}>
      <AppRail
        title={t('discover.topApps')}
        data={rails.top}
        keyExtractor={appKey}
        renderItem={(app, index) => <RankCard app={app} rank={index + 1} />}
      />
      <AppRail
        title={t('discover.recommended')}
        data={rails.recommended}
        keyExtractor={appKey}
        renderItem={(app) => <PosterCard app={app} />}
      />
      <AppRail
        title={t('discover.recentlyUpdated')}
        data={rails.recent}
        keyExtractor={appKey}
        renderItem={(app) => <PosterCard app={app} />}
      />
      {rails.categories.map(({ name, list }) => (
        <AppRail
          key={name}
          title={name}
          data={list}
          keyExtractor={appKey}
          renderItem={(app) => <PosterCard app={app} />}
        />
      ))}
    </View>
  );
};

const styles = themedStyles(() => ({
  feed: {
    gap: spacing.xl,
    paddingTop: spacing.sm,
  },
}));
