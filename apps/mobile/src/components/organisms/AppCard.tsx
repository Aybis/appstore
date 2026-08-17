import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatBytes } from '../../utils/format';
import { IconPlaceholder, StatusPill } from '../atoms';
import { InstallButton, RatingStars } from '../molecules';
import { useInstalls } from '../../install/InstallProvider';
import type { App } from '../../types';

type Props = {
  app: App;
  /** Called when an already-installed, current app is opened. */
  onOpen: (app: App) => void;
};

/** Row card used in the main catalog list. */
export const AppCard = ({ app, onOpen }: Props) => {
  const router = useRouter();
  const { stateFor, snapshotFor, requestInstall, installedVersionFor } = useInstalls();

  const state = stateFor(app);
  const snapshot = snapshotFor(app.slug);
  const installedVersion = installedVersionFor(app.slug);

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/app/[slug]', params: { slug: app.slug } })
      }
      accessibilityRole="button"
      accessibilityLabel={`${app.name}, ${app.category}, version ${app.version}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <IconPlaceholder seed={app.slug} name={app.name} size={56} />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {app.name}
          </Text>
          {app.accessStatus !== 'available' && (
            <StatusPill status={app.accessStatus} />
          )}
        </View>

        <Text style={styles.tagline} numberOfLines={1}>
          {app.tagline}
        </Text>

        <View style={styles.metaRow}>
          <RatingStars rating={app.rating} size={12} starsOnly />
          <Text style={styles.meta} numberOfLines={1}>
            {state === 'update' && installedVersion
              ? `v${installedVersion} → v${app.version}`
              : `${app.category} · v${app.version} · ${formatBytes(app.size)}`}
          </Text>
        </View>
      </View>

      {/* Its own Pressable, so tapping the action does not also open detail. */}
      <InstallButton
        state={state}
        snapshot={snapshot}
        disabled={app.accessStatus !== 'available'}
        onPress={() => (state === 'open' ? onOpen(app) : requestInstall(app))}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.text,
    flexShrink: 1,
  },
  tagline: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  meta: {
    ...typography.label,
    fontWeight: '500',
    color: colors.textTertiary,
    flexShrink: 1,
  },
});
