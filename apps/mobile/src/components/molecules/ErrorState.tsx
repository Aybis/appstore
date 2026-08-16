import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { toErrorMessage } from '../../api';
import { Button } from '../atoms';
import { StateMessage } from './StateMessage';

type Props = {
  error: unknown;
  onRetry?: () => void;
};

export const ErrorState = ({ error, onRetry }: Props) => (
  <StateMessage
    media={
      <View style={styles.badge}>
        <Text style={styles.badgeLabel}>!</Text>
      </View>
    }
    title="Something went wrong"
    body={toErrorMessage(error)}
    action={
      onRetry ? (
        <Button
          label="Try again"
          variant="secondary"
          onPress={onRetry}
          style={styles.action}
        />
      ) : undefined
    }
  />
);

const styles = StyleSheet.create({
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
  action: {
    marginTop: spacing.md,
    minWidth: 160,
  },
});
