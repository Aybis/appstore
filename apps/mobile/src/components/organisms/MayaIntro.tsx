import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, themedStyles, typography } from '../../constants/theme';
import { FadeIn } from '../../motion';
import { MayaMark } from '../atoms';

const LETTERS = ['M', 'A', 'Y', 'A'] as const;
/** Mirrors the squircle ratio MayaMark rounds its own viewBox by, so the
 * sheen mask clips to the same shape as the mark underneath it. */
const MARK_CORNER_RATIO = 0.1875;
/** Long enough to read as "then the name arrives", short enough not to wait. */
const WORDMARK_DELAY_MS = 140;
const LETTER_STEP_MS = 90;
const SHEEN_SWEEP_MS = 3200;

type Props = { size?: number };

/**
 * The brand intro on the splash: the mark sits still while a slow sheen sweeps
 * it and the wordmark letters stagger in beneath.
 *
 * THE MARK DELIBERATELY DOES NOT ANIMATE IN. It used to spring from 0.8 scale
 * with a fade, which was the right idea when this was the first thing drawn —
 * but it is not. Android shows a native splash first, and that splash now draws
 * the same mark at the same size on the same ground. Anything that scales or
 * fades the mark on arrival turns an invisible handoff into a visible pop, on
 * exactly the frame the user is most likely to notice.
 *
 * The gentle float went for the same reason: it moved the mark off the position
 * the native splash left it in, immediately.
 *
 * So the mark is the seam, and everything that animates happens around it.
 */
export const MayaIntro = ({ size = 96 }: Props) => {
  const sheen = useSharedValue(0);

  useEffect(() => {
    sheen.value = withDelay(
      WORDMARK_DELAY_MS,
      withRepeat(
        withTiming(1, { duration: SHEEN_SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [sheen]);

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${-130 + sheen.value * 260}%` }],
  }));

  const markRadius = size * MARK_CORNER_RATIO;

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size }}>
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
      </View>

      {/*
        Absolutely positioned, so only the MARK is in the container's flow. The
        parent centres the container, which therefore centres the mark itself —
        the same point the native splash centres its image on. With the wordmark
        in flow the group would be centred instead, lifting the mark above that
        point and making it jump at the handoff.
      */}
      <View style={styles.wordmark}>
        {LETTERS.map((letter, index) => (
          <FadeIn
            key={`${letter}-${index}`}
            delayMs={WORDMARK_DELAY_MS + index * LETTER_STEP_MS}
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
  },
  sheenMask: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  wordmark: {
    position: 'absolute',
    top: '100%',
    marginTop: 18,
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
