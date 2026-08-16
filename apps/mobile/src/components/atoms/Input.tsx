import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

type Props = TextInputProps & {
  /** Draws the error border — the message itself belongs to FormField. */
  invalid?: boolean;
};

export const Input = ({ invalid = false, style, ...rest }: Props) => {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
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
      style={[
        styles.input,
        focused && styles.focused,
        invalid && styles.invalid,
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    height: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    ...typography.body,
    color: colors.text,
  },
  focused: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  invalid: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
});
