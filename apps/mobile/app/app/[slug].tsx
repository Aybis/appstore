import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, Paragraph } from '../../src/components/atoms';
import {
  ErrorState,
  InfoTable,
  LoadingState,
  Section,
  SpecStrip,
} from '../../src/components/molecules';
import {
  AppHero,
  InstallBar,
  ScreenshotCarousel,
} from '../../src/components/organisms';
import {
  AppDetailTemplate,
  CenteredTemplate,
} from '../../src/components/templates';
import { useAppDetail, useDownload } from '../../src/hooks';
import { spacing } from '../../src/constants/theme';
import { formatBytes, formatDate } from '../../src/utils/format';
import type { App } from '../../src/types';

const SHOT_WIDTH_RATIO = 0.62;
const SHOT_MAX_WIDTH = 260;
const SHOT_ASPECT = 1.9;

const platformLabel = (app: App): string =>
  app.platform === 'ios' ? 'iOS (IPA)' : 'Android (APK)';

/** App detail page (BRD FR-1.5 + P4 download/install). */
export default function AppDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { data: app, loading, error, refresh } = useAppDetail(slug);
  const download = useDownload(app);

  if (loading) {
    return (
      <CenteredTemplate>
        <LoadingState label="Loading app details…" />
      </CenteredTemplate>
    );
  }

  if (error || !app) {
    return (
      <CenteredTemplate>
        <ErrorState
          error={error ?? new Error('App not found')}
          onRetry={refresh}
        />
      </CenteredTemplate>
    );
  }

  const shotWidth = Math.min(width * SHOT_WIDTH_RATIO, SHOT_MAX_WIDTH);

  return (
    <>
      <Stack.Screen options={{ title: app.name }} />
      <AppDetailTemplate
        bottomInset={insets.bottom}
        footer={
          <InstallBar
            app={app}
            onInstall={download.start}
            installing={download.starting}
            bottomInset={insets.bottom}
          />
        }
      >
        <AppHero app={app} />

        <Paragraph style={styles.tagline}>{app.tagline}</Paragraph>

        <SpecStrip
          specs={[
            { label: 'VERSION', value: app.version },
            { label: 'SIZE', value: formatBytes(app.size) },
            { label: 'CATEGORY', value: app.category },
            { label: 'REQUIRES', value: app.minOs },
          ]}
        />

        <Section title="Preview">
          <ScreenshotCarousel
            urls={app.screenshotUrls}
            itemWidth={shotWidth}
            itemHeight={shotWidth * SHOT_ASPECT}
          />
        </Section>

        <Section title="About this app">
          <Paragraph>{app.description}</Paragraph>
        </Section>

        <Section title={`What's new in ${app.version}`}>
          <Paragraph>{app.releaseNotes}</Paragraph>
          <Caption>Released {formatDate(app.updatedAt)}</Caption>
        </Section>

        <Section title="Information">
          <InfoTable
            rows={[
              { label: 'Platform', value: platformLabel(app) },
              { label: 'Minimum OS', value: app.minOs },
              { label: 'Publisher', value: app.publisher },
              {
                label: 'Package',
                value: `com.internal.${app.slug.replace(/-/g, '')}`,
              },
              { label: 'Download size', value: formatBytes(app.size) },
            ]}
          />
        </Section>
      </AppDetailTemplate>
    </>
  );
}

const styles = StyleSheet.create({
  tagline: {
    marginTop: -spacing.sm,
  },
});
