import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';

type Props = {
  /** Spinner, badge, or illustration shown above the text. */
  media?: ReactNode;
  title?: string;
  body?: string;
  action?: ReactNode;
};

/**
 * Shared shell for the loading / error / empty states so all three sit at the
 * same optical position and share one set of spacing rules (NFR-7).
 */
export const StateMessage = ({ media, title, body, action }: Props) => (
  <View style={styles.container}>
    {media}
    {title ? <Text style={styles.title}>{title}</Text> : null}
    {body ? <Text style={styles.body}>{body}</Text> : null}
    {action}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  body: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
