import { StateMessage } from './StateMessage';

type Props = {
  title?: string;
  body?: string;
};

export const EmptyState = ({
  title = 'No apps found',
  body = 'Try a different search term or category.',
}: Props) => <StateMessage title={title} body={body} />;
