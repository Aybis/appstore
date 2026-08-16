import { StyleSheet, Text, View, type TextInputProps } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';
import { Input } from '../atoms';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
};

/** Label + input + inline error, sharing one accessibility label. */
export const FormField = ({ label, error, ...inputProps }: Props) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Input {...inputProps} invalid={Boolean(error)} accessibilityLabel={label} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
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
