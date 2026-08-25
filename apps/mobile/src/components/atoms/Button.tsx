import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, shadow, spacing, themedStyles, typography } from '../../constants/theme';
import { PressableScale } from '../../motion';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft';

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
            <ActivityIndicator color={indicatorColorFor(variant)} />
          </View>
        )}
      </View>
    </PressableScale>
  );
};

const styles = themedStyles(() => ({
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
}));

const variantStyles = themedStyles(() => ({
  primary: { backgroundColor: colors.accent, ...shadow.accentGlow },
  secondary: { backgroundColor: colors.surfaceStrong },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.danger },
  /*
   * Soft red: the destructive tint without the destructive weight.
   *
   * Signing out is reversible — you sign back in — so a solid red button
   * overstates it and makes the genuinely irreversible ones mean less. This
   * says "careful" rather than "danger".
   */
  dangerSoft: { backgroundColor: colors.dangerSoft },
}));

const labelStyles = themedStyles(() => ({
  primary: { color: colors.onAccent },
  secondary: { color: colors.text },
  ghost: { color: colors.accent },
  // danger's fill is as light as the accent, so it takes the same dark label.
  danger: { color: colors.textInverse },
  dangerSoft: { color: colors.danger },
}));

/*
 * A FUNCTION, not a record. `colors` is a proxy that resolves against whichever
 * palette is active AT THE MOMENT A PROPERTY IS READ — so a module-level object
 * literal reads it once, at import, and freezes that scheme's values forever.
 * This app starts dark, so the frozen value was the dark one, and after a switch
 * to light it painted light text on a light fill. Reading inside a call keeps it
 * honest.
 */
const indicatorColorFor = (variant: Variant): string =>
  ({
    primary: colors.onAccent,
    dangerSoft: colors.danger,
    secondary: colors.text,
    ghost: colors.accent,
    danger: colors.textInverse,
  })[variant];
