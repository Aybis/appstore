import { colors } from '../../constants/theme';
import { SearchIcon } from '../atoms';
import { IconBadge, StateMessage } from './StateMessage';

type Props = {
  title?: string;
  body?: string;
};

export const EmptyState = ({
  title = 'No apps found',
  body = 'Try a different search term or category.',
}: Props) => (
  <StateMessage
    media={
      <IconBadge tone="accent">
        <SearchIcon size={28} color={colors.accent} strokeWidth={1.75} />
      </IconBadge>
    }
    title={title}
    body={body}
  />
);
