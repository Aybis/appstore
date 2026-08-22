import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, gradients, radius, spacing, typography } from '../../constants/theme';
import { FadeIn, timing } from '../../motion';
import { Button } from '../atoms';
import { formatBytes } from '../../utils/format';
import { useInstalls } from '../../install/InstallProvider';
import { isInstallBusy } from '../../install/pipeline';
import type { App } from '../../types';

type Props = {
  app: App;
  /** Safe-area bottom inset, so the bar clears the home indicator. */
  bottomInset: number;
};

/** Extra height the dissolve reaches above the bar's own content. */
const FADE_HEIGHT = 56;

/** Pinned install action with live download progress (BRD P4). */
export const InstallBar = ({ app, bottomInset }: Props) => {
  const { stateFor, snapshotFor, requestInstall, installedVersionFor } = useInstalls();

  const state = stateFor(app);
  const snapshot = snapshotFor(app.slug);
  const installedVersion = installedVersionFor(app.slug);
  const busy = isInstallBusy(snapshot.phase);

  const label = (): string => {
    if (app.accessStatus === 'restricted') return 'Restricted';
    if (app.accessStatus === 'unsupported') return 'Unsupported device';

    switch (snapshot.phase) {
      case 'preparing':
        return 'Preparing…';
      case 'downloading':
        return snapshot.progress === null
          ? 'Downloading…'
          : `Downloading ${Math.round(snapshot.progress * 100)}%`;
      case 'installing':
        return 'Opening installer…';
      case 'done':
        return 'Installed';
      case 'error':
        // Resumes from the bytes already on disk, not from zero.
        return 'Retry';
      default:
        if (app.platform === 'ios') return 'Install instructions';
        return state === 'update' ? 'Update' : state === 'open' ? 'Open' : 'Install';
    }
  };

  const note = (): string | null => {
    if (app.accessStatus === 'restricted') {
      return 'You do not have access to this app. Request it from IT.';
    }
    if (app.accessStatus === 'unsupported') {
      return `Not supported on this device — ${app.minOs} required.`;
    }
    if (snapshot.phase === 'error') return snapshot.error;
    if (snapshot.phase === 'done') return 'Handed to the system installer.';
    if (snapshot.detail) return snapshot.detail;
    if (state === 'update' && installedVersion) {
      return `Installed v${installedVersion} · latest v${app.version}`;
    }
    if (state === 'open') return 'Installed and up to date.';
    return null;
  };

  const message = note();
  const showBar = snapshot.phase === 'downloading' && snapshot.progress !== null;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(snapshot.progress ?? 0, timing.normal);
  }, [snapshot.progress, progress]);

  // Grows via scaleX (anchored left through transformOrigin) rather than an
  // animated width, so the fill composites on the UI thread like every other
  // motion in the app instead of triggering a layout pass every tick.
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View style={[styles.bar, { paddingBottom: bottomInset }]}>
      <LinearGradient
        colors={[...gradients.canvasFade]}
        pointerEvents="none"
        style={[styles.fade, { top: -FADE_HEIGHT }]}
      />

      <FadeIn style={styles.content} translateY={10}>
        {showBar && (
          <View style={styles.track} accessibilityRole="progressbar">
            <Animated.View style={[styles.fill, fillStyle]} />
          </View>
        )}

        <Button
          label={label()}
          hint={`v${app.version} · ${formatBytes(app.size)}`}
          onPress={() => requestInstall(app)}
          loading={snapshot.phase === 'preparing' || snapshot.phase === 'installing'}
          disabled={
            app.accessStatus !== 'available' || busy || snapshot.phase === 'done'
          }
        />

        {message ? (
          <Text
            style={[styles.note, snapshot.phase === 'error' && styles.noteError]}
            numberOfLines={2}
          >
            {message}
          </Text>
        ) : null}
      </FadeIn>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  track: {
    height: 4,
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
  note: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  noteError: {
    color: colors.danger,
  },
});
