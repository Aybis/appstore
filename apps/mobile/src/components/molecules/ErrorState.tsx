import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../constants/theme';
import { toErrorMessage } from '../../api';
import { AlertIcon, Button } from '../atoms';
import { IconBadge, StateMessage } from './StateMessage';

type Props = {
  error: unknown;
  onRetry?: () => void;
};

export const ErrorState = ({ error, onRetry }: Props) => (
  <StateMessage
    media={
      <IconBadge tone="danger">
        <AlertIcon size={28} color={colors.danger} strokeWidth={1.75} />
      </IconBadge>
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
  action: {
    marginTop: spacing.md,
    minWidth: 160,
  },
});
