import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, SectionTitle } from '../../src/components/atoms';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../src/components/molecules';
import { InstalledAppCard } from '../../src/components/organisms';
import { ListTemplate } from '../../src/components/templates';
import { useInstalledApps, type InstalledApp } from '../../src/hooks';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/theme';
import { TAB_BAR_HEIGHT } from '../../src/constants/layout';
import { spacing } from '../../src/constants/theme';

/**
 * Apps this device installed through MAYA.
 *
 * Deliberately not "apps installed on this phone": iOS exposes no API to
 * enumerate other apps, and Android gates it behind the Play-restricted
 * QUERY_ALL_PACKAGES. The list is built from our own install log instead.
 */
export default function MyAppsScreen() {
  const insets = useSafeAreaInsets();
  const installed = useInstalledApps();
  const t = useT();
  // Subscribes this screen to the palette so a theme change re-renders it,
  // and through it everything it renders. See ThemeProvider.
  useTheme();

  const entries = installed.data ?? [];
  const updateCount = entries.filter((entry) => entry.updateAvailable).length;

  const empty = () => {
    if (installed.loading) return <LoadingState label={t('state.loadingApps')} />;
    if (installed.error) {
      return <ErrorState error={installed.error} onRetry={installed.refresh} />;
    }
    return (
      <EmptyState
        title={t('myApps.empty.title')}
        body={t('myApps.empty.body')}
      />
    );
  };

  return (
    <ListTemplate<InstalledApp>
      data={entries}
      keyExtractor={(entry) => entry.app.id}
      renderItem={(entry) => <InstalledAppCard entry={entry} />}
      header={
        entries.length > 0 ? (
          <View style={styles.header}>
            <SectionTitle>
              {t(
                entries.length === 1 ? 'discover.count_one' : 'discover.count_other',
                { count: entries.length },
              )}
            </SectionTitle>
            <Caption>
              {updateCount > 0
                ? t(
                    updateCount === 1 ? 'myApps.updates_one' : 'myApps.updates_other',
                    { count: updateCount },
                  )
                : t('myApps.upToDate')}
            </Caption>
          </View>
        ) : null
      }
      empty={empty()}
      refreshing={installed.refreshing}
      onRefresh={installed.refresh}
      bottomInset={insets.bottom + TAB_BAR_HEIGHT}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
});
