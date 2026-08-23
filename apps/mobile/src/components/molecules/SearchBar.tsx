import { useEffect, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, radius, spacing, themedStyles, typography } from '../../constants/theme';
import { CloseIcon, SearchGlyph } from '../atoms';
import { PressableScale, spring } from '../../motion';

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  /** Required — the default used to be an English literal baked in here. */
  placeholder: string;
};

/**
 * Glyph + input + clear button acting as one search control.
 *
 * The ring is a hairline border painted transparent at rest so it can spring
 * in on focus without the field changing size — same technique as `Input`.
 * The clear button lives in its own Animated.View so it can spring in/out by
 * scale+opacity (never by width) as `value` goes from empty to non-empty.
 */
export const SearchBar = ({
  value,
  onChangeText,
  placeholder,
}: Props) => {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;

  const focusProgress = useSharedValue(0);
  const clearProgress = useSharedValue(hasValue ? 1 : 0);

  useEffect(() => {
    focusProgress.value = withSpring(focused ? 1 : 0, spring.standard);
  }, [focused, focusProgress]);

  useEffect(() => {
    clearProgress.value = withSpring(hasValue ? 1 : 0, spring.bouncy);
  }, [hasValue, clearProgress]);

  const containerStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusProgress.value,
      [0, 1],
      ['transparent', colors.accent],
    ),
    backgroundColor: interpolateColor(
      focusProgress.value,
      [0, 1],
      [colors.surfaceInset, colors.surfaceStrong],
    ),
    transform: [{ translateY: focusProgress.value * -2 }],
  }));

  const clearStyle = useAnimatedStyle(() => ({
    opacity: clearProgress.value,
    transform: [{ scale: clearProgress.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <SearchGlyph />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        keyboardAppearance="dark"
        selectionColor={colors.accent}
        accessibilityLabel={placeholder}
      />
      <Animated.View style={clearStyle} pointerEvents={hasValue ? 'auto' : 'none'}>
        <PressableScale
          onPress={() => onChangeText('')}
          hitSlop={10}
          scaleTo="icon"
          haptic="tap"
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={styles.clear}
        >
          <CloseIcon size={11} color={colors.textSecondary} strokeWidth={2} />
        </PressableScale>
      </Animated.View>
    </Animated.View>
  );
};

const styles = themedStyles(() => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
  },
  clear: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
  },
}));
