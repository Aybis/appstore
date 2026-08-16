import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { toErrorMessage } from '../api';
import { Button } from './Button';

/** Shared loading / error / empty presentation (NFR-7). */

export const LoadingState = ({ label = 'Loading apps…' }: { label?: string }) => (
  <View style={styles.container}>
    <ActivityIndicator color={colors.accent} />
    <Text style={styles.body}>{label}</Text>
  </View>
);

export const ErrorState = ({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) => (
  <View style={styles.container}>
    <View style={styles.badge}>
      <Text style={styles.badgeLabel}>!</Text>
    </View>
    <Text style={styles.title}>Something went wrong</Text>
    <Text style={styles.body}>{toErrorMessage(error)}</Text>
    {onRetry && (
      <Button
        label="Try again"
        variant="secondary"
        onPress={onRetry}
        style={styles.action}
      />
    )}
  </View>
);

export const EmptyState = ({
  title = 'No apps found',
  body = 'Try a different search term or category.',
}: {
  title?: string;
  body?: string;
}) => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.body}>{body}</Text>
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
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  badgeLabel: {
    ...typography.title,
    color: colors.danger,
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
  action: {
    marginTop: spacing.md,
    minWidth: 160,
  },
});
