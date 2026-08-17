import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatBytes } from '../../utils/format';
import { Button, Caption, IconPlaceholder } from '../atoms';
import { InfoTable } from '../molecules';
import { useInstalls } from '../../install/InstallProvider';

/**
 * Confirmation before anything is fetched.
 *
 * These downloads run to hundreds of megabytes on a connection the company may
 * be paying for, so the user sees exactly what is about to be transferred —
 * name, version, size — and opts in. Nothing touches the network until they do.
 */
export const InstallConfirmSheet = () => {
  const insets = useSafeAreaInsets();
  const { pending, confirmInstall, cancelInstall, stateFor, installedVersionFor } =
    useInstalls();

  if (!pending) return null;

  const state = stateFor(pending);
  const installedVersion = installedVersionFor(pending.slug);
  const updating = state === 'update';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={cancelInstall}>
      <Pressable
        style={styles.scrim}
        onPress={cancelInstall}
        accessibilityLabel="Cancel"
      />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.grabber} />

        <View style={styles.header}>
          <IconPlaceholder seed={pending.slug} name={pending.name} size={56} />
          <View style={styles.headerText}>
            <Text style={styles.title}>
              {updating ? `Update ${pending.name}?` : `Install ${pending.name}?`}
            </Text>
            <Text style={styles.publisher}>{pending.publisher}</Text>
          </View>
        </View>

        <InfoTable
          rows={[
            ...(updating && installedVersion
              ? [{ label: 'Installed', value: `v${installedVersion}` }]
              : []),
            { label: updating ? 'New version' : 'Version', value: `v${pending.version}` },
            { label: 'Download size', value: formatBytes(pending.size) },
            { label: 'Requires', value: pending.minOs },
          ]}
        />

        <Caption style={styles.note}>
          {formatBytes(pending.size)} will be downloaded over your current
          connection. You can leave the screen — the download continues while the
          app is open.
        </Caption>

        <View style={styles.actions}>
          <Button
            label={updating ? 'Update' : 'Install'}
            onPress={confirmInstall}
          />
          <Button label="Cancel" variant="ghost" onPress={cancelInstall} />
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  publisher: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  note: {
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
  },
});
