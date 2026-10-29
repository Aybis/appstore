import { useEffect, useSyncExternalStore } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '../../components/atoms';
import { colors, radius, shadow, spacing, themedStyles, typography } from '../../theme/tokens';
import { spring, timing } from '../../motion';
import { useT } from '../../i18n';
import { currentDialog, settleDialog, subscribeDialogs } from './dialog';

/**
 * Draws whatever `confirmDialog` / `showMessage` asked for.
 *
 * Mounted once, at the root. If a theme or language change remounts it while a
 * question is open, nothing is lost: the question lives in the store, and this
 * reads it again on the way back up.
 */
export const DialogHost = () => {
  const t = useT();
  const dialog = useSyncExternalStore(subscribeDialogs, currentDialog, currentDialog);
  const visible = dialog !== null;
  const isQuestion = Boolean(dialog?.cancelLabel);

  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = visible ? withSpring(1, spring.sheet) : withTiming(0, timing.fast);
  }, [visible, enter]);

  const panel = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 24 }, { scale: 0.96 + enter.value * 0.04 }],
  }));

  if (!dialog) return null;

  // Outside taps and the back button mean "no" for a question, and simply
  // "got it" for a notice, where there is no no.
  const dismiss = () => settleDialog(dialog.id, false);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={dismiss} accessibilityLabel={dialog.title}>
        {/* Swallows presses so tapping the panel itself does not dismiss it. */}
        <Pressable onPress={() => undefined} style={styles.hit}>
          <Animated.View style={[styles.panel, panel]}>
            <Text style={styles.title}>{dialog.title}</Text>
            {dialog.message ? <Text style={styles.body}>{dialog.message}</Text> : null}

            <View style={styles.actions}>
              <Button
                label={dialog.confirmLabel ?? t('dialog.ok')}
                variant={dialog.tone === 'danger' ? 'danger' : 'primary'}
                onPress={() => settleDialog(dialog.id, true)}
              />
              {isQuestion ? (
                <Button
                  label={dialog.cancelLabel ?? t('dialog.cancel')}
                  variant="ghost"
                  onPress={dismiss}
                />
              ) : null}
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
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
  hit: {
    width: '100%',
    maxWidth: 420,
  },
  panel: {
    width: '100%',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadow.sheet,
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
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
}));
