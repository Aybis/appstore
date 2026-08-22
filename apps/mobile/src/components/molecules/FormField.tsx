import { useState } from 'react';
import { StyleSheet, Text, View, type TextInputProps } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';
import { FadeIn, PressableScale } from '../../motion';
import { EyeIcon, Input } from '../atoms';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
};

/**
 * Label + input + inline error.
 *
 * When the field is a password it grows a show/hide toggle: typing a password
 * blind on a phone keyboard is the single most common cause of a failed login,
 * and every store app offers the reveal.
 */
export const FormField = ({ label, error, ...inputProps }: Props) => {
  const isPassword = Boolean(inputProps.secureTextEntry);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.inputRow}>
        <Input
          {...inputProps}
          secureTextEntry={isPassword && !revealed}
          invalid={Boolean(error)}
          accessibilityLabel={label}
          style={isPassword ? styles.inputWithAccessory : undefined}
        />

        {isPassword && (
          <PressableScale
            onPress={() => setRevealed((current) => !current)}
            hitSlop={12}
            scaleTo="icon"
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            accessibilityState={{ selected: revealed }}
            style={styles.toggle}
          >
            <EyeIcon
              off={!revealed}
              color={revealed ? colors.accent : colors.textTertiary}
            />
          </PressableScale>
        )}
      </View>

      {/* Springs in rather than snapping, so a validation error doesn't yank
          the layout the instant it appears. */}
      {error ? (
        <FadeIn translateY={6}>
          <Text style={styles.error}>{error}</Text>
        </FadeIn>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  inputRow: {
    justifyContent: 'center',
  },
  /** Leaves room for the eye so long passwords do not run under it. */
  inputWithAccessory: {
    paddingRight: spacing.xxl + spacing.md,
  },
  toggle: {
    position: 'absolute',
    right: spacing.lg,
    height: '100%',
    justifyContent: 'center',
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
