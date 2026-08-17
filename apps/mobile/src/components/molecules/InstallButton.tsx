import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { isInstallBusy, type InstallSnapshot } from '../../install/pipeline';
import type { AppInstallState } from '../../install/InstallProvider';

type Props = {
  state: AppInstallState;
  snapshot: InstallSnapshot;
  onPress: () => void;
  disabled?: boolean;
};

const LABEL: Record<AppInstallState, string> = {
  install: 'Install',
  update: 'Update',
  open: 'Open',
};

/**
 * The compact action on a catalog row, mirroring a public store: Install when
 * this device has no record of the app, Update when the catalog is ahead of the
 * installed version, Open when it is current.
 */
export const InstallButton = ({ state, snapshot, onPress, disabled }: Props) => {
  const busy = isInstallBusy(snapshot.phase);
  const failed = snapshot.phase === 'error';

  const label = failed
    ? 'Retry'
    : snapshot.phase === 'downloading' && snapshot.progress !== null
      ? `${Math.round(snapshot.progress * 100)}%`
      : LABEL[state];

  // "Open" is a read action, so it reads as secondary; Install/Update are the
  // primary call to action and carry the accent.
  const secondary = state === 'open' && !busy && !failed;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondary : styles.primary,
        failed && styles.failed,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {busy && snapshot.phase !== 'downloading' ? (
        <ActivityIndicator size="small" color={colors.textInverse} />
      ) : (
        <View style={styles.content}>
          <Text
            style={[styles.label, secondary ? styles.labelSecondary : styles.labelPrimary]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}

      {snapshot.phase === 'downloading' && snapshot.progress !== null && (
        <View style={[styles.progress, { width: `${snapshot.progress * 100}%` }]} />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minWidth: 76,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primary: { backgroundColor: colors.accent },
  secondary: {
    backgroundColor: colors.accentSoft,
  },
  failed: { backgroundColor: colors.danger },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  content: { alignItems: 'center' },
  label: {
    ...typography.label,
    fontWeight: '700',
  },
  labelPrimary: { color: colors.textInverse },
  labelSecondary: { color: colors.accent },
  /** Fills behind the label as the download advances. */
  progress: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.textInverse,
    opacity: 0.9,
  },
});
