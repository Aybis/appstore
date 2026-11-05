import { useEffect } from 'react';
import { BackHandler, Linking, Modal, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Button, MayaMark } from '../../components/atoms';
import { colors, radius, shadow, spacing, themedStyles, typography } from '../../theme/tokens';
import { spring, timing } from '../../motion';
import { useT } from '../../i18n';
import { formatBytes } from '../../utils/format';
import { canUpdateInApp, useInAppUpdate } from './useInAppUpdate';
import type { VersionCheck } from './version-check';

type Props = {
  check: VersionCheck | null;
  visible: boolean;
  onDismiss: () => void;
  /** Called as the update link is opened — for the host's analytics, say. */
  onUpdate?: () => void;
  /** App name shown in the copy. Defaults to the running app's own name. */
  appName?: string;
};

/**
 * The update prompt, in the two shapes the organization's rule defines.
 *
 * A MAJOR change (first or second digit) is presented with a single action and
 * no way out: no cancel button, no scrim tap, and the Android hardware back
 * button is captured. A MINOR change (last digit only) gets "Later" alongside
 * "Update".
 *
 * The blocking case is enforced in three places on purpose. A modal that can be
 * escaped by one of the three is not blocking, and which one a user reaches for
 * is not something the code gets to assume.
 *
 * On Android, when the update is MAYA's own APK, "Update now" downloads it
 * right here with a progress bar and then opens the system installer — the
 * user never leaves for the browser. Everything else opens `storeUrl`.
 */
export const UpdateGate = ({ check, visible, onDismiss, onUpdate, appName }: Props) => {
  const t = useT();
  const required = Boolean(check?.updateRequired);
  const inApp = canUpdateInApp(check);
  const { state: update, start } = useInAppUpdate(check);
  const busy = update.phase === 'downloading' || update.phase === 'installing';

  const enter = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(update.progress ?? 0, timing.normal);
  }, [update.progress, progress]);

  // Grows via scaleX, as InstallBar's does, so the fill animates on the UI
  // thread instead of re-laying out the modal every tick.
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  useEffect(() => {
    enter.value = visible
      ? withSpring(1, spring.sheet)
      : withTiming(0, timing.fast);
  }, [visible, enter]);

  // Android hardware back. Returning true swallows the press; the listener is
  // only registered while a required update is on screen, so ordinary back
  // behaviour is untouched everywhere else.
  useEffect(() => {
    if (!visible || !required) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [visible, required]);

  const panel = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: (1 - enter.value) * 24 },
      { scale: 0.96 + enter.value * 0.04 },
    ],
  }));

  if (!check) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Also swallows the back press at the Modal level on Android. Belt and
      // braces with the BackHandler above, because a Modal with no
      // onRequestClose logs a warning and closes itself on some versions.
      onRequestClose={() => {
        if (!required && !busy) onDismiss();
      }}
      statusBarTranslucent
    >
      <View style={styles.scrim}>
        <Animated.View style={[styles.panel, panel]}>
          <View style={styles.mark}>
            <MayaMark size={44} />
          </View>

          <Text style={styles.title}>
            {required ? t('update.requiredTitle') : t('update.availableTitle')}
          </Text>

          <Text style={styles.body}>
            {required
              ? t('update.requiredBody', {
                  app: appName ?? t('update.thisApp'),
                  version: check.latestVersion,
                })
              : t('update.availableBody', {
                  app: appName ?? t('update.thisApp'),
                  version: check.latestVersion,
                })}
          </Text>

          <View style={styles.versions}>
            <Text style={styles.versionFrom}>{check.currentVersion}</Text>
            <Text style={styles.versionArrow}>→</Text>
            <Text style={styles.versionTo}>{check.latestVersion}</Text>
          </View>

          {check.releaseNotes.trim().length > 0 && (
            <View style={styles.notes}>
              <Text style={styles.notesLabel}>{t('update.whatsNew')}</Text>
              <Text style={styles.notesBody} numberOfLines={6}>
                {check.releaseNotes.trim()}
              </Text>
            </View>
          )}

          {update.phase === 'downloading' && (
            <View style={styles.download} accessibilityRole="progressbar" accessibilityValue={{
              min: 0,
              max: 100,
              now: update.progress === null ? undefined : Math.round(update.progress * 100),
            }}>
              <View style={styles.downloadHead}>
                <Text style={styles.downloadLabel}>
                  {update.progress === null
                    ? t('update.downloadingUnknown')
                    : t('update.downloading', { percent: String(Math.round(update.progress * 100)) })}
                </Text>
                <Text style={styles.downloadBytes}>
                  {update.bytesTotal > 0
                    ? `${formatBytes(update.bytesWritten)} / ${formatBytes(update.bytesTotal)}`
                    : formatBytes(update.bytesWritten)}
                </Text>
              </View>
              <View style={styles.track}>
                <Animated.View style={[styles.fill, fill]} />
              </View>
            </View>
          )}

          {update.phase === 'ready' && <Text style={styles.status}>{t('update.readyHint')}</Text>}
          {update.phase === 'error' && (
            <Text style={[styles.status, styles.statusError]}>{t('update.failed')}</Text>
          )}

          <View style={styles.actions}>
            {update.phase !== 'downloading' && (
              <Button
                label={
                  update.phase === 'ready'
                    ? t('update.install')
                    : update.phase === 'error'
                      ? t('update.retry')
                      : t('update.action')
                }
                loading={update.phase === 'installing'}
                onPress={() => {
                  if (update.phase === 'idle') onUpdate?.();
                  if (inApp) void start();
                  else void Linking.openURL(check.storeUrl);
                }}
              />
            )}
            {/* Rendered only when the update is optional — and `onDismiss` is
                inert for a required one regardless, so this is presentation,
                not the enforcement. Hidden mid-download so the bar is not
                left running behind a closed prompt. */}
            {!required && !busy && (
              <Button label={t('update.later')} variant="ghost" onPress={onDismiss} />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = themedStyles(() => ({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadow.sheet,
  },
  mark: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  versions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  versionFrom: {
    ...typography.mono,
    color: colors.textTertiary,
  },
  versionArrow: {
    ...typography.mono,
    color: colors.textTertiary,
  },
  versionTo: {
    ...typography.mono,
    color: colors.accent,
    fontWeight: '700',
  },
  notes: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  notesLabel: {
    ...typography.label,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  notesBody: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  download: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  downloadHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  downloadLabel: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  downloadBytes: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    width: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    transformOrigin: 'left',
  },
  status: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statusError: {
    color: colors.danger,
  },
}));
