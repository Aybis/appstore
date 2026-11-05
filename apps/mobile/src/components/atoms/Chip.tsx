import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, radius, spacing, themedStyles, typography } from '../../theme/tokens';
import { getActivePalette } from '../../theme';
import { PressableScale, spring } from '../../motion';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * Selectable pill. Content-agnostic on purpose — the catalog uses it for both
 * the category filter and the sort filter.
 *
 * The border is always painted at hairline width but transparent at rest, so
 * the accent ring fading in on selection never shifts the chip's layout.
 */
export const Chip = ({ label, selected, onPress }: Props) => {
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, spring.standard);
  }, [selected, progress]);

  // Read the palette into a plain object HERE, in render, and use that inside the
  // animated style below. Reanimated copies whatever an animated style refers to
  // the first time it sees it, and `colors` is one long-lived proxy: the copy of
  // it made under the first theme was reused after a switch, so the fill kept the
  // old palette while the text (read at render time) took the new one.
  const palette = getActivePalette();

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [palette.surface, palette.accentSoftStrong],
    ),
    borderColor: interpolateColor(progress.value, [0, 1], ['transparent', palette.accent]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.03]) }],
  }));

  return (
    <PressableScale
      onPress={onPress}
      scaleTo="control"
      haptic="select"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={styles.chip}
    >
      {/*
       * The fill sits on its own absolutely-positioned layer so the animated
       * background/border can be typed against Animated.View rather than
       * PressableScale's plain StyleProp<ViewStyle> — it still scales and
       * presses together with the label because both are PressableScale's
       * children, not because the fill carries the press animation itself.
       */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.fill, animatedStyle]} />
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </PressableScale>
  );
};

const styles = themedStyles(() => ({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  fill: {
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.accent,
  },
}));
