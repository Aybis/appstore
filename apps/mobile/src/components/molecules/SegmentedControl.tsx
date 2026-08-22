import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { colors, radius, spacing, themedStyles, typography } from '../../constants/theme';
import { PressableScale, spring } from '../../motion';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel?: string;
};

/**
 * Pill-track selector for a small closed set — theme and language here.
 *
 * The selected indicator is one absolutely-positioned view that SPRINGS between
 * slots rather than a background toggled per segment: the movement is what
 * makes the control feel physical, and it is the same reason the tab bar
 * animates its active glyph instead of only recolouring it.
 */
export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: Props<T>) => {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const position = useSharedValue(index);

  useEffect(() => {
    position.value = withSpring(index, spring.standard);
  }, [index, position]);

  // translateX, not `left`: a transform is composited off the main thread,
  // while animating `left` relayouts the track on every frame. The percentage
  // is relative to the indicator's OWN width, so one slot is exactly 100%.
  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: `${position.value * 100}%` }],
  }));

  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      <Animated.View
        style={[styles.indicator, { width: `${100 / options.length}%` }, indicator]}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            onPress={() => onChange(option.value)}
            scaleTo="control"
            haptic="select"
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={styles.segment}
          >
            <Text
              style={[styles.label, selected && styles.labelSelected]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
};

const styles = themedStyles(() => ({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.pill,
    padding: spacing.xs,
  },
  indicator: {
    position: 'absolute',
    top: spacing.xs,
    bottom: spacing.xs,
    backgroundColor: colors.accentSoftStrong,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.accent,
  },
}));
