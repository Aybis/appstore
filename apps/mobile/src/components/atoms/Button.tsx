import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../../constants/theme';
import { PressableScale } from '../../motion';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Small caption under the label, e.g. "42.3 MB · v3.2.1". */
  hint?: string;
  style?: StyleProp<ViewStyle>;
};

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  hint,
  style,
}: Props) => {
  const inactive = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      scaleTo="control"
      haptic={variant === 'primary' ? 'confirm' : 'tap'}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[styles.base, variantStyles[variant], inactive && styles.disabled, style]}
    >
      <View style={styles.content}>
        {/*
         * The label stays laid out (just invisible) while loading, rather than
         * being replaced by the spinner, so the button never resizes mid-press.
         */}
        <View style={[styles.labelStack, loading && styles.hiddenLabel]}>
          <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
          {hint ? <Text style={[styles.hint, labelStyles[variant]]}>{hint}</Text> : null}
        </View>
        {loading && (
          <View style={[StyleSheet.absoluteFill, styles.spinner]} pointerEvents="none">
            <ActivityIndicator color={indicatorColor[variant]} />
          </View>
        )}
      </View>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelStack: {
    alignItems: 'center',
    gap: 2,
  },
  hiddenLabel: {
    opacity: 0,
  },
  spinner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.bodyStrong,
  },
  hint: {
    ...typography.label,
    fontWeight: '500',
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.accent, ...shadow.accentGlow },
  secondary: { backgroundColor: colors.surfaceStrong },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.danger },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.onAccent },
  secondary: { color: colors.text },
  ghost: { color: colors.accent },
  // danger's fill is as light as the accent, so it takes the same dark label.
  danger: { color: colors.textInverse },
});

const indicatorColor: Record<Variant, string> = {
  primary: colors.onAccent,
  secondary: colors.text,
  ghost: colors.accent,
  danger: colors.textInverse,
};
