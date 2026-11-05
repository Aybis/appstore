import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, themedStyles } from '../../theme/tokens';
import { useReducedMotion } from '../../motion';

type Props = {
  icon?: LucideIcon;
  /** Drawn in place of the icon — the brand mark on the auth screens. */
  children?: ReactNode;
  /** Overrides the coral: fill of the outer ring, of the core, and of pulse and sparks. */
  tint?: { ring: string; core: string; accent: string };
  /** The box the art fills; the rings are sized to its shorter side. */
  width: number;
  height: number;
};

const BREATH_MS = 2600;
const FLOAT_MS = 2200;
const PULSE_MS = 2800;
const ORBIT_MS = 9000;

const ease = Easing.inOut(Easing.sin);

/**
 * A screen's artwork: one Lucide icon inside soft coral rings — and ALIVE.
 *
 * Four slow loops that never compete with the form below it:
 *   - the rings breathe;
 *   - a ring of light pulses outward and fades, like a signal;
 *   - the icon floats and tilts a few degrees;
 *   - two small sparks orbit the rings.
 *
 * Only transform and opacity are animated, so every loop runs on the UI thread
 * and none of them touches layout. With "reduce motion" on, it draws the final
 * still picture instead — the animation is decoration, never information.
 */
export const IconArt = ({ icon: Icon, children, tint, width, height }: Props) => {
  const reduced = useReducedMotion();
  const outer = Math.min(width, height) * 0.78;
  const inner = outer * 0.68;

  const breath = useSharedValue(0);
  const float = useSharedValue(0);
  const pulse = useSharedValue(0);
  const orbit = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      [breath, float, pulse, orbit].forEach((value) => {
        cancelAnimation(value);
        value.value = 0;
      });
      return;
    }
    breath.value = withRepeat(withTiming(1, { duration: BREATH_MS, easing: ease }), -1, true);
    float.value = withRepeat(withTiming(1, { duration: FLOAT_MS, easing: ease }), -1, true);
    pulse.value = withRepeat(
      withDelay(400, withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) })),
      -1,
      false,
    );
    orbit.value = withRepeat(withTiming(1, { duration: ORBIT_MS, easing: Easing.linear }), -1, false);
    return () => {
      [breath, float, pulse, orbit].forEach((value) => cancelAnimation(value));
    };
  }, [reduced, breath, float, pulse, orbit]);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.05 }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (1 - breath.value) * 0.04 }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : 0.55 * (1 - pulse.value),
    transform: [{ scale: 0.8 + pulse.value * 0.55 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (float.value - 0.5) * 10 },
      { rotate: `${(float.value - 0.5) * 8}deg` },
    ],
  }));
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value * 360}deg` }],
  }));

  const spark = Math.max(6, outer * 0.045);

  return (
    <View
      style={[styles.box, { width, height }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* The signal: a ring that grows out from the artwork and fades. */}
      <Animated.View
        style={[
          styles.pulse,
          { width: outer, height: outer, borderRadius: outer / 2 },
          tint && { borderColor: tint.accent },
          pulseStyle,
        ]}
      />

      <Animated.View
        style={[
          styles.ring,
          { width: outer, height: outer, borderRadius: outer / 2 },
          tint && { backgroundColor: tint.ring },
          outerStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.core,
            { width: inner, height: inner, borderRadius: inner / 2 },
            tint && { backgroundColor: tint.core },
            innerStyle,
          ]}
        >
          <Animated.View style={iconStyle}>
            {children ?? (Icon ? <Icon size={inner * 0.46} color={colors.highlight} strokeWidth={1.75} /> : null)}
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* Two sparks riding a turning frame, opposite each other. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.orbit, { width: outer * 1.12, height: outer * 1.12 }, orbitStyle]}
      >
        <View
          style={[
            styles.spark,
            { width: spark, height: spark, borderRadius: spark / 2, top: 0, alignSelf: 'center' },
            tint && { backgroundColor: tint.accent },
          ]}
        />
        <View
          style={[
            styles.spark,
            {
              width: spark * 0.7,
              height: spark * 0.7,
              borderRadius: spark,
              bottom: 0,
              alignSelf: 'center',
              opacity: 0.6,
            },
            tint && { backgroundColor: tint.accent },
          ]}
        />
      </Animated.View>
    </View>
  );
};

const styles = themedStyles(() => ({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.highlightSoft,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.highlightSoft,
  },
  pulse: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.highlight,
  },
  orbit: {
    position: 'absolute',
  },
  spark: {
    position: 'absolute',
    backgroundColor: colors.highlight,
  },
}));
