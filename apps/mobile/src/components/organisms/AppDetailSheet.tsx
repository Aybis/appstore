import { useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
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

import { blur, colors, radius, shadow, spacing, themedStyles } from '../../constants/theme';
import { formatBytes, formatDate } from '../../utils/format';
import { haptics, spring, timing } from '../../motion';
import { Button, Caption, Paragraph } from '../atoms';
import { InfoTable } from '../molecules';
import { useInstalls } from '../../install/InstallProvider';
import { AppHero } from './AppHero';
import type { App } from '../../types';

type Props = {
  app: App | null;
  onClose: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** How far below the screen the panel parks before it is unmounted. */
const EXIT_DISTANCE = 900;
/** Drag distance past which a release dismisses instead of springing back. */
const DISMISS_THRESHOLD = 120;
/** Flick speed that dismisses even if released before the distance threshold. */
const FLING_VELOCITY = 800;

/**
 * Bottom sheet shown when an already-installed, up-to-date app is opened from
 * the list — the quick look, rather than a full navigation to the detail route.
 */
export const AppDetailSheet = ({ app, onClose }: Props) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { installedVersionFor } = useInstalls();

  const translateY = useSharedValue(EXIT_DISTANCE);
  const scrimOpacity = useSharedValue(0);

  // The component stays mounted (this just returns null) whenever there is no
  // app, so the entrance has to replay on every open, not just on first mount.
  useEffect(() => {
    if (!app) return;
    translateY.value = EXIT_DISTANCE;
    scrimOpacity.value = 0;
    translateY.value = withSpring(0, spring.sheet);
    scrimOpacity.value = withTiming(1, timing.normal);
  }, [app, translateY, scrimOpacity]);

  // Plays the close motion, then hands off to whatever should actually close
  // the sheet — so the panel is already off-screen by the time `app` goes
  // null and this returns null instead of the Modal.
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
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0, spring.sheet);
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!app) return null;
  const installedVersion = installedVersionFor(app.slug);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={() => dismiss(onClose)}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.fill}>
        {/* Tapping the scrim dismisses, matching platform sheet behaviour. */}
        <AnimatedPressable
          style={[styles.scrim, scrimStyle]}
          onPress={() => dismiss(onClose)}
          accessibilityLabel="Close"
        />

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheetShadow, panelStyle]}>
            <View style={styles.sheet}>
              <BlurView intensity={blur.sheet} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, styles.glassTint]} />

              <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
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
                  onPress={() =>
                    dismiss(() => {
                      onClose();
                      router.push({ pathname: '/app/[slug]', params: { slug: app.slug } });
                    })
                  }
                />
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = themedStyles(() => ({
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
  note: {
    textAlign: 'center',
  },
}));
