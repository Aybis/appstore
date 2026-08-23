import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, themedStyles, typography } from '../../constants/theme';
import { FadeIn, spring, timing } from '../../motion';
import { MayaMark } from '../atoms';

const LETTERS = ['M', 'A', 'Y', 'A'] as const;
/** Mirrors the squircle ratio MayaMark rounds its own viewBox by, so the
 * sheen mask clips to the same shape as the mark underneath it. */
const MARK_CORNER_RATIO = 0.28;
/** Roughly when the entrance spring has visually settled. */
const MARK_ENTER_DELAY_MS = 480;
const LETTER_STEP_MS = 90;
const SHEEN_SWEEP_MS = 3200;

type Props = { size?: number };

/**
 * Animated brand intro for onboarding: the mark springs in from 0.8 scale
 * with a fade, a slow gradient sheen sweeps across it once settled, the
 * wordmark letters stagger in after, and the mark keeps a gentle float so the
 * screen is not static while the user reads.
 */
export const MayaIntro = ({ size = 96 }: Props) => {
  const enterScale = useSharedValue(0.8);
  const enterOpacity = useSharedValue(0);
  const float = useSharedValue(0);
  const sheen = useSharedValue(0);

  useEffect(() => {
    enterScale.value = withSpring(1, spring.bouncy);
    enterOpacity.value = withTiming(1, timing.normal);
    float.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    sheen.value = withDelay(
      MARK_ENTER_DELAY_MS,
      withRepeat(
        withTiming(1, { duration: SHEEN_SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [enterScale, enterOpacity, float, sheen]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: enterOpacity.value,
    transform: [
      { scale: enterScale.value },
      { translateY: interpolate(float.value, [0, 1], [0, -10]) },
    ],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${-130 + sheen.value * 260}%` }],
  }));

  const markRadius = size * MARK_CORNER_RATIO;

  return (
    <View style={styles.container}>
      <Animated.View style={[{ width: size, height: size }, markStyle]}>
        <MayaMark size={size} />
        <View
          style={[styles.sheenMask, { borderRadius: markRadius }]}
          pointerEvents="none"
        >
          <Animated.View style={[StyleSheet.absoluteFill, sheenStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </Animated.View>

      <View style={styles.wordmark}>
        {LETTERS.map((letter, index) => (
          <FadeIn
            key={`${letter}-${index}`}
            delayMs={MARK_ENTER_DELAY_MS + index * LETTER_STEP_MS}
            translateY={12}
          >
            <Text style={styles.letter}>{letter}</Text>
          </FadeIn>
        ))}
      </View>
    </View>
  );
};

const styles = themedStyles(() => ({
  container: {
    alignItems: 'center',
    gap: 14,
  },
  sheenMask: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  wordmark: {
    flexDirection: 'row',
    gap: 8,
  },
  letter: {
    ...typography.display,
    fontSize: 30,
    letterSpacing: 2,
    color: colors.text,
  },
}));
