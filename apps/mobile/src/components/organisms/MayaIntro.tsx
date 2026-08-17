import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors, typography } from '../../constants/theme';
import { MayaMark } from '../atoms';

const LETTERS = ['M', 'A', 'Y', 'A'] as const;

/**
 * Animated brand intro for onboarding: the mark springs in, the wordmark
 * letters stagger after it, then the mark keeps a slow float so the screen is
 * not static while the user reads.
 *
 * Uses the built-in Animated API rather than Reanimated — every value here is
 * transform/opacity, so it all runs on the native driver without the extra
 * dependency.
 */
export const MayaIntro = ({ size = 96 }: { size?: number }) => {
  const enter = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const letters = useRef(LETTERS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(enter, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.stagger(
        90,
        letters.map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();

    const drift = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    drift.start();

    return () => drift.stop();
  }, [enter, float, letters]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          opacity: enter,
          transform: [
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
            {
              translateY: float.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -10],
              }),
            },
          ],
        }}
      >
        <MayaMark size={size} />
      </Animated.View>

      <View style={styles.wordmark}>
        {LETTERS.map((letter, index) => (
          <Animated.Text
            key={`${letter}-${index}`}
            style={[
              styles.letter,
              {
                opacity: letters[index],
                transform: [
                  {
                    translateY:
                      letters[index]?.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }) ?? 0,
                  },
                ],
              },
            ]}
          >
            {letter}
          </Animated.Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 14,
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
});
