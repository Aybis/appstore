/**
 * Skeleton placeholder with a travelling highlight.
 *
 * Loading states are the one place a duration beats a spring: there is no
 * gesture to inherit velocity from, and the point is a steady rhythm that tells
 * the user the app is alive. A spinner says "wait"; a skeleton in the shape of
 * the content says "this is what is coming", which is what makes a catalog feel
 * fast even when the network is not.
 */

import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius } from '../constants/theme';
import { useReducedMotion } from './useReducedMotion';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

const SWEEP_MS = 1250;

export const Shimmer = ({
  width = '100%',
  height = 16,
  borderRadius = radius.sm,
  style,
}: Props) => {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    // A skeleton is decoration; a static block still communicates "loading".
    if (reduced) return;

    progress.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    // An infinite repeat keeps running on the UI thread until told otherwise.
    // Several skeletons mounting and unmounting as screens change would
    // otherwise accumulate sweeps nobody is looking at.
    return () => cancelAnimation(progress);
  }, [progress, reduced]);

  const sweep = useAnimatedStyle(() => ({
    // Travels from fully left of the box to fully right of it. Expressed in
    // percent so it works without measuring the parent.
    transform: [{ translateX: `${-100 + progress.value * 200}%` }],
  }));

  return (
    <View
      style={[
        { width, height, borderRadius, backgroundColor: colors.surface, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, sweep]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.10)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};
