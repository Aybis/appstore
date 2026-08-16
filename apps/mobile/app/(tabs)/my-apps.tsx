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

  const entries = installed.data ?? [];
  const updateCount = entries.filter((entry) => entry.updateAvailable).length;

  const empty = () => {
    if (installed.loading) return <LoadingState label="Loading your apps…" />;
    if (installed.error) {
      return <ErrorState error={installed.error} onRetry={installed.refresh} />;
    }
    return (
      <EmptyState
        title="Nothing installed yet"
        body="Apps you install from Discover show up here, with update status."
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
              {entries.length} {entries.length === 1 ? 'app' : 'apps'}
            </SectionTitle>
            <Caption>
              {updateCount > 0
                ? `${updateCount} update${updateCount === 1 ? '' : 's'} available`
                : 'Everything is up to date'}
            </Caption>
          </View>
        ) : null
      }
      empty={empty()}
      refreshing={installed.refreshing}
      onRefresh={installed.refresh}
      bottomInset={insets.bottom}
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
