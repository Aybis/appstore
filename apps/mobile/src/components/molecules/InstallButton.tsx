import { useEffect, useRef, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { colors, radius, spacing, themedStyles, typography } from '../../constants/theme';
import { haptics, PressableScale, spring } from '../../motion';
import { isInstallBusy, type InstallSnapshot } from '../../install/pipeline';
import type { AppInstallState } from '../../install/InstallProvider';
import { ArrowUpRightIcon, CheckIcon, DownloadIcon, RefreshIcon, type IconProps } from '../atoms';

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

const ICON: Record<AppInstallState, ComponentType<IconProps>> = {
  install: DownloadIcon,
  update: RefreshIcon,
  open: ArrowUpRightIcon,
};

type Tone = 'primary' | 'secondary' | 'danger' | 'disabled';

const RING_RADIUS = 6;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Indeterminate ring for the preparing/installing hand-off. Not an
 * ActivityIndicator: that draws a different glyph per platform and never
 * takes a token colour, which reads as borrowed chrome on this button.
 */
const Spinner = ({ color }: { color: string }) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 850, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Svg width={16} height={16} viewBox="0 0 16 16">
        <Circle
          cx={8}
          cy={8}
          r={RING_RADIUS}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${RING_CIRCUMFERENCE * 0.72} ${RING_CIRCUMFERENCE}`}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
};

/**
 * The catalog row's action — a compact pill that morphs between
 * Install/Update/Open/Retry, a determinate download fill, and a completion
 * check, all in one control. This is the app's signature interaction, so
 * every visual change here is a spring, never a snap.
 */
export const InstallButton = ({ state, snapshot, onPress, disabled }: Props) => {
  const busy = isInstallBusy(snapshot.phase);
  const failed = snapshot.phase === 'error';
  // The provider leaves the snapshot at 'done' after the install log refresh
  // has already flipped `state` to 'open' — this reads true only for the brief
  // gap between the two, which is exactly when the check should be on screen.
  const justFinished = snapshot.phase === 'done' && state !== 'open';
  const determinate = snapshot.phase === 'downloading' && snapshot.progress !== null;
  const indeterminate = busy && !determinate;
  const secondary = state === 'open' && !busy && !failed && !justFinished;

  const tone: Tone = disabled ? 'disabled' : failed ? 'danger' : secondary ? 'secondary' : 'primary';

  // The fill is a dark veil over the accent pill that RECEDES to the right as
  // progress advances, rather than a track that fills — so the percentage
  // label never has to sit half on accent, half on empty track and change
  // colour partway through. transformOrigin anchors the scale to the trailing
  // edge so it reads as "uncovering", not stretching from the centre.
  const veil = useSharedValue(1);
  useEffect(() => {
    veil.value = withSpring(determinate ? 1 - (snapshot.progress ?? 0) : 0, spring.standard);
  }, [determinate, snapshot.progress, veil]);
  const veilStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: veil.value }],
  }));

  const wasDone = useRef(false);
  useEffect(() => {
    if (snapshot.phase === 'done' && !wasDone.current) haptics.success();
    wasDone.current = snapshot.phase === 'done';
  }, [snapshot.phase]);

  const check = useSharedValue(0);
  useEffect(() => {
    check.value = withSpring(justFinished ? 1 : 0, spring.bouncy);
  }, [justFinished, check]);
  const checkStyle = useAnimatedStyle(() => ({
    opacity: check.value,
    transform: [{ scale: check.value }],
  }));

  // Every branch below is a different "shape" of content in the same pill;
  // this key changes on any of them so the swap gets one shared morph instead
  // of each branch inventing its own entrance.
  const visualKey = failed
    ? 'error'
    : justFinished
      ? 'done'
      : indeterminate
        ? 'busy'
        : determinate
          ? 'progress'
          : state;
  const morph = useSharedValue(0);
  useEffect(() => {
    morph.value = 0;
    morph.value = withSpring(1, spring.standard);
  }, [visualKey, morph]);
  const morphStyle = useAnimatedStyle(() => ({
    opacity: morph.value,
    transform: [{ scale: 0.86 + morph.value * 0.14 }],
  }));

  const Glyph = failed ? RefreshIcon : ICON[state];
  const label = failed
    ? 'Retry'
    : determinate && snapshot.progress !== null
      ? `${Math.round(snapshot.progress * 100)}%`
      : LABEL[state];

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || busy}
      scaleTo="control"
      haptic={secondary ? 'tap' : 'confirm'}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) || busy, busy }}
      style={[styles.button, toneStyles[tone], disabled && styles.disabledDim]}
    >
      {determinate && tone === 'primary' && (
        <Animated.View style={[styles.veil, veilStyle]} pointerEvents="none" />
      )}

      <Animated.View style={[styles.content, morphStyle]}>
        {justFinished ? (
          <Animated.View style={checkStyle}>
            <CheckIcon size={16} color={colors.onAccent} strokeWidth={2.5} />
          </Animated.View>
        ) : indeterminate ? (
          <Spinner color={contentColor[tone]} />
        ) : (
          <View style={styles.row}>
            {!determinate && <Glyph size={14} color={contentColor[tone]} strokeWidth={2.25} />}
            <Text style={[styles.label, { color: contentColor[tone] }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        )}
      </Animated.View>
    </PressableScale>
  );
};

const styles = themedStyles(() => ({
  button: {
    minWidth: 82,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /** Visible, not just functional, disablement — a flat muted fill. */
  disabledDim: {
    opacity: 0.55,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    fontWeight: '700',
  },
  veil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.onAccent,
    opacity: 0.24,
    transformOrigin: 'right',
  },
}));

const toneStyles = themedStyles(() => ({
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.accentSoft },
  danger: { backgroundColor: colors.danger },
  disabled: { backgroundColor: colors.surfaceStrong },
}));

const contentColor: Record<Tone, string> = {
  primary: colors.onAccent,
  secondary: colors.accent,
  danger: colors.textInverse,
  disabled: colors.textTertiary,
};
