import { Stack, useLocalSearchParams } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  ErrorState,
  IconPlaceholder,
  LoadingState,
  RatingStars,
  Screenshot,
  StatusPill,
} from '../../src/components';
import { useAppDetail, useDownload } from '../../src/hooks';
import { colors, radius, spacing, typography } from '../../src/constants/theme';
import { formatBytes, formatDate } from '../../src/utils/format';
import type { App } from '../../src/types';

/** Single label/value cell in the spec strip. */
const Spec = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.spec}>
    <Text style={styles.specLabel}>{label}</Text>
    <Text style={styles.specValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

/** App detail screen (BRD FR-1.5 + P4 download/install). */
export default function AppDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { data: app, loading, error, refresh } = useAppDetail(slug);
  const download = useDownload(app);

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState label="Loading app details…" />
      </View>
    );
  }

  if (error || !app) {
    return (
      <View style={styles.screen}>
        <ErrorState error={error ?? new Error('App not found')} onRetry={refresh} />
      </View>
    );
  }

  const shotWidth = Math.min(width * 0.62, 260);
  const shotHeight = shotWidth * 1.9;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: app.name }} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <IconPlaceholder seed={app.slug} name={app.name} size={84} />
          <View style={styles.heroText}>
            <Text style={styles.name}>{app.name}</Text>
            <Text style={styles.publisher}>{app.publisher}</Text>
            <View style={styles.heroMeta}>
              <RatingStars rating={app.rating} count={app.ratingCount} />
              <StatusPill status={app.accessStatus} />
            </View>
          </View>
        </View>

        <Text style={styles.tagline}>{app.tagline}</Text>

        <View style={styles.specStrip}>
          <Spec label="VERSION" value={app.version} />
          <View style={styles.specDivider} />
          <Spec label="SIZE" value={formatBytes(app.size)} />
          <View style={styles.specDivider} />
          <Spec label="CATEGORY" value={app.category} />
          <View style={styles.specDivider} />
          <Spec label="REQUIRES" value={app.minOs} />
        </View>

        <Section title="Preview">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={shotWidth + spacing.md}
            decelerationRate="fast"
            contentContainerStyle={styles.shotRow}
          >
            {app.screenshotUrls.map((url, index) => (
              <Screenshot
                key={url}
                url={url}
                index={index}
                width={shotWidth}
                height={shotHeight}
              />
            ))}
          </ScrollView>
        </Section>

        <Section title="About this app">
          <Text style={styles.body}>{app.description}</Text>
        </Section>

        <Section title={`What's new in ${app.version}`}>
          <Text style={styles.body}>{app.releaseNotes}</Text>
          <Text style={styles.updatedAt}>
            Released {formatDate(app.updatedAt)}
          </Text>
        </Section>

        <Section title="Information">
          <View style={styles.infoTable}>
            <InfoRow label="Platform" value={platformLabel(app)} />
            <InfoRow label="Minimum OS" value={app.minOs} />
            <InfoRow label="Publisher" value={app.publisher} />
            <InfoRow label="Package" value={`com.internal.${app.slug.replace(/-/g, '')}`} />
            <InfoRow label="Download size" value={formatBytes(app.size)} />
          </View>
        </Section>
      </ScrollView>

      <View style={[styles.installBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={installLabel(app)}
          hint={`v${app.version} · ${formatBytes(app.size)}`}
          onPress={download.start}
          loading={download.starting}
          disabled={app.accessStatus !== 'available'}
        />
        {app.accessStatus === 'restricted' && (
          <Text style={styles.installNote}>
            You do not have access to this app. Request it from IT.
          </Text>
        )}
        {app.accessStatus === 'unsupported' && (
          <Text style={styles.installNote}>
            Not supported on this device — {app.minOs} required.
          </Text>
        )}
      </View>
    </View>
  );
}

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const platformLabel = (app: App): string =>
  app.platform === 'ios' ? 'iOS (IPA)' : 'Android (APK)';

const installLabel = (app: App): string => {
  if (app.accessStatus === 'restricted') return 'Restricted';
  if (app.accessStatus === 'unsupported') return 'Unsupported device';
  return app.platform === 'ios' ? 'Install instructions' : 'Install';
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  hero: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.title,
    color: colors.text,
  },
  publisher: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
  specStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  spec: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  specLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.6,
  },
  specValue: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.text,
  },
  specDivider: {
    width: 1,
    height: 26,
    backgroundColor: colors.border,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  shotRow: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  body: {
    ...typography.body,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  updatedAt: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  infoTable: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  installBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  installNote: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
