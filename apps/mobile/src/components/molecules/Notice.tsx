import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

type Props = {
  title: string;
  body: string;
};

/** Tinted callout for a non-blocking piece of information. */
export const Notice = ({ title, body }: Props) => (
  <View style={styles.notice}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.body}>{body}</Text>
  </View>
);

const styles = StyleSheet.create({
  notice: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    gap: spacing.xs,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.accent,
  },
  body: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
});
