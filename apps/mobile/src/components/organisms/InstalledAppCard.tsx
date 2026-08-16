import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatDate } from '../../utils/format';
import { Badge, IconPlaceholder } from '../atoms';
import type { InstalledApp } from '../../hooks/useInstalledApps';

type Props = { entry: InstalledApp };

/** Row in "My Apps" — catalog metadata plus this device's install record. */
export const InstalledAppCard = ({ entry }: Props) => {
  const { app, record, updateAvailable } = entry;

  return (
    <Link href={{ pathname: '/app/[slug]', params: { slug: app.slug } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${app.name}, installed version ${record.version}${
          updateAvailable ? `, update to ${app.version} available` : ''
        }`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <IconPlaceholder seed={app.slug} name={app.name} size={52} />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>
              {app.name}
            </Text>
            {updateAvailable && <Badge label="UPDATE" />}
          </View>

          <Text style={styles.meta} numberOfLines={1}>
            {updateAvailable
              ? `v${record.version} → v${app.version}`
              : `v${record.version} · up to date`}
          </Text>

          <Text style={styles.installed} numberOfLines={1}>
            Installed {formatDate(record.installedAt)}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
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
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  installed: {
    ...typography.label,
    fontWeight: '500',
    color: colors.textTertiary,
  },
});
