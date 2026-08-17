import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../../constants/theme';
import { formatBytes, formatDate } from '../../utils/format';
import { Button, Caption, Paragraph } from '../atoms';
import { InfoTable } from '../molecules';
import { useInstalls } from '../../install/InstallProvider';
import { AppHero } from './AppHero';
import type { App } from '../../types';

type Props = {
  app: App | null;
  onClose: () => void;
};

/**
 * Bottom sheet shown when an already-installed, up-to-date app is opened from
 * the list — the quick look, rather than a full navigation to the detail route.
 */
export const AppDetailSheet = ({ app, onClose }: Props) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { installedVersionFor } = useInstalls();

  if (!app) return null;
  const installedVersion = installedVersionFor(app.slug);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Tapping the scrim dismisses, matching platform sheet behaviour. */}
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.grabber} />

        <AppHero app={app} />

        <Paragraph numberOfLines={3}>{app.tagline || app.description}</Paragraph>

        <InfoTable
          rows={[
            { label: 'Installed version', value: installedVersion ?? '—' },
            { label: 'Latest version', value: app.version },
            { label: 'Size', value: formatBytes(app.size) },
            { label: 'Requires', value: app.minOs },
            { label: 'Updated', value: formatDate(app.updatedAt) },
          ]}
        />

        <Caption style={styles.note}>
          Already installed and up to date on this device.
        </Caption>

        <Button
          label="View full details"
          variant="secondary"
          onPress={() => {
            onClose();
            router.push({ pathname: '/app/[slug]', params: { slug: app.slug } });
          }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(13,17,23,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
  note: {
    textAlign: 'center',
  },
});
