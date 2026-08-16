import { ActivityIndicator } from 'react-native';
import { colors } from '../../constants/theme';
import { StateMessage } from './StateMessage';

type Props = { label?: string };

export const LoadingState = ({ label = 'Loading apps…' }: Props) => (
  <StateMessage media={<ActivityIndicator color={colors.accent} />} body={label} />
);
