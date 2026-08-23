import { useEffect } from 'react';
import { BackHandler, Linking, Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Button, MayaMark } from '../components/atoms';
import { colors, radius, shadow, spacing, themedStyles, typography } from '../constants/theme';
import { spring, timing } from '../motion';
import { useT } from '../i18n';
import type { VersionCheck } from './version-check';

type Props = {
  check: VersionCheck | null;
  visible: boolean;
  onDismiss: () => void;
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
 */
export const UpdateGate = ({ check, visible, onDismiss, appName }: Props) => {
  const t = useT();
  const required = Boolean(check?.updateRequired);

  const enter = useSharedValue(0);

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
        if (!required) onDismiss();
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

          <View style={styles.actions}>
            <Button
              label={t('update.action')}
              onPress={() => void Linking.openURL(check.storeUrl)}
            />
            {/* Rendered only when the update is optional — and `onDismiss` is
                inert for a required one regardless, so this is presentation,
                not the enforcement. */}
            {!required && (
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
}));
