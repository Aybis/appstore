import { colors } from '../../constants/theme';
import { SearchIcon } from './icons';

type Props = {
  size?: number;
  color?: string;
};

/** Magnifier — thin stroke to match the search bar's placeholder weight. */
export const SearchGlyph = ({ size = 18, color = colors.textTertiary }: Props) => (
  <SearchIcon size={size} color={color} strokeWidth={1.6} />
);
