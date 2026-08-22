import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { spring } from '../../motion';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = TextInputProps & {
  /** Draws the error border — the message itself belongs to FormField. */
  invalid?: boolean;
};

/**
 * The ring is a hairline border painted transparent at rest, so it can spring
 * in on focus without the field changing size — same technique as Chip.
 */
export const Input = ({ invalid = false, style, ...rest }: Props) => {
  const [focused, setFocused] = useState(false);
  const focusProgress = useSharedValue(0);

  useEffect(() => {
    focusProgress.value = withSpring(focused ? 1 : 0, spring.standard);
  }, [focused, focusProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: invalid
      ? colors.danger
      : interpolateColor(focusProgress.value, [0, 1], ['transparent', colors.accent]),
  }));

  return (
    <AnimatedTextInput
      {...rest}
      onFocus={(event) => {
        setFocused(true);
        rest.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        rest.onBlur?.(event);
      }}
      placeholderTextColor={colors.textTertiary}
      keyboardAppearance="dark"
      selectionColor={colors.accent}
      style={[styles.input, invalid && styles.invalid, animatedStyle, style]}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    height: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.surfaceInset,
    ...typography.body,
    color: colors.text,
  },
  invalid: {
    backgroundColor: colors.dangerSoft,
  },
});
