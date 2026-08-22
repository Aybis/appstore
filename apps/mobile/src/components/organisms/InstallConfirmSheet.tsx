import { useCallback, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { blur, colors, radius, shadow, spacing, typography } from '../../constants/theme';
import { formatBytes } from '../../utils/format';
import { haptics, spring, timing } from '../../motion';
import { Button, Caption, IconPlaceholder } from '../atoms';
import { InfoTable } from '../molecules';
import { useInstalls } from '../../install/InstallProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** How far below the screen the panel parks before it is unmounted. */
const EXIT_DISTANCE = 900;
/** Drag distance past which a release dismisses instead of springing back. */
const DISMISS_THRESHOLD = 120;
/** Flick speed that dismisses even if released before the distance threshold. */
const FLING_VELOCITY = 800;

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

  const translateY = useSharedValue(EXIT_DISTANCE);
  const scrimOpacity = useSharedValue(0);

  // The component stays mounted (this just returns null) whenever nothing is
  // pending, so the entrance has to replay on every open, not just on mount.
  useEffect(() => {
    if (!pending) return;
    translateY.value = EXIT_DISTANCE;
    scrimOpacity.value = 0;
    translateY.value = withSpring(0, spring.sheet);
    scrimOpacity.value = withTiming(1, timing.normal);
  }, [pending, translateY, scrimOpacity]);

  // Plays the close motion, then hands off to whatever should actually settle
  // the pending install — so the panel is already off-screen by the time
  // `pending` goes null and this returns null instead of the Modal.
  const dismiss = useCallback(
    (after: () => void) => {
      scrimOpacity.value = withTiming(0, timing.fast);
      translateY.value = withTiming(EXIT_DISTANCE, timing.fast, (finished) => {
        if (finished) runOnJS(after)();
      });
    },
    [translateY, scrimOpacity],
  );

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.translationY > DISMISS_THRESHOLD || event.velocityY > FLING_VELOCITY;
      if (shouldDismiss) {
        runOnJS(haptics.tap)();
        scrimOpacity.value = withTiming(0, timing.fast);
        translateY.value = withTiming(EXIT_DISTANCE, timing.fast, (finished) => {
          if (finished) runOnJS(cancelInstall)();
        });
      } else {
        translateY.value = withSpring(0, spring.sheet);
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!pending) return null;

  const state = stateFor(pending);
  const installedVersion = installedVersionFor(pending.slug);
  const updating = state === 'update';

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={() => dismiss(cancelInstall)}
    >
      <GestureHandlerRootView style={styles.fill}>
        <AnimatedPressable
          style={[styles.scrim, scrimStyle]}
          onPress={() => dismiss(cancelInstall)}
          accessibilityLabel="Cancel"
        />

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheetShadow, panelStyle]}>
            <View style={styles.sheet}>
              <BlurView intensity={blur.sheet} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, styles.glassTint]} />

              <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
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
                    {
                      label: updating ? 'New version' : 'Version',
                      value: `v${pending.version}`,
                    },
                    { label: 'Download size', value: formatBytes(pending.size) },
                    { label: 'Requires', value: pending.minOs },
                  ]}
                />

                <Caption style={styles.note}>
                  {formatBytes(pending.size)} will be downloaded over your current
                  connection. You can leave the screen — the download continues while
                  the app is open.
                </Caption>

                <View style={styles.actions}>
                  <Button
                    label={updating ? 'Update' : 'Install'}
                    onPress={() => dismiss(confirmInstall)}
                  />
                  <Button
                    label="Cancel"
                    variant="ghost"
                    onPress={() => dismiss(cancelInstall)}
                  />
                </View>
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheetShadow: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    ...shadow.sheet,
  },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    overflow: 'hidden',
    backgroundColor: colors.backgroundElevated,
  },
  glassTint: {
    backgroundColor: colors.surfaceInset,
  },
  content: {
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
