import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles, typography } from '../../constants/theme';
import { formatDate } from '../../utils/format';
import { Badge, IconPlaceholder } from '../atoms';
import { FadeIn, PressableScale } from '../../motion';
import type { InstalledApp } from '../../hooks/useInstalledApps';

type Props = {
  entry: InstalledApp;
  /** Position in the list — drives the entrance stagger. */
  index?: number;
};

/** Row in "My Apps" — catalog metadata plus this device's install record. */
export const InstalledAppCard = ({ entry, index = 0 }: Props) => {
  const router = useRouter();
  const { app, record, updateAvailable } = entry;

  return (
    <FadeIn index={index}>
      <PressableScale
        onPress={() =>
          router.push({ pathname: '/app/[slug]', params: { slug: app.slug } })
        }
        scaleTo="card"
        accessibilityRole="button"
        accessibilityLabel={`${app.name}, installed version ${record.version}${
          updateAvailable ? `, update to ${app.version} available` : ''
        }`}
        style={[styles.card, updateAvailable && styles.cardUpdate]}
      >
        {updateAvailable ? (
          <View style={styles.iconRing}>
            <IconPlaceholder seed={app.slug} name={app.name} size={52} />
          </View>
        ) : (
          <IconPlaceholder seed={app.slug} name={app.name} size={52} />
        )}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>
              {app.name}
            </Text>
            {updateAvailable && <Badge label="UPDATE" />}
          </View>

          <Text
            style={[styles.meta, updateAvailable && styles.metaUpdate]}
            numberOfLines={1}
          >
            {updateAvailable
              ? `v${record.version} → v${app.version}`
              : `v${record.version} · up to date`}
          </Text>

          <Text style={styles.installed} numberOfLines={1}>
            Installed {formatDate(record.installedAt)}
          </Text>
        </View>
      </PressableScale>
    </FadeIn>
  );
};

const styles = themedStyles(() => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  /** Loud on purpose — an update waiting is the one state this list exists to surface. */
  cardUpdate: {
    backgroundColor: colors.accentSoft,
  },
  iconRing: {
    padding: 3,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.accent,
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
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metaUpdate: {
    fontWeight: '700',
    color: colors.accent,
  },
  installed: {
    ...typography.label,
    fontWeight: '500',
    color: colors.textTertiary,
  },
}));
