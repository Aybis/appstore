import type { ColorValue } from 'react-native';

import { colors } from '../../constants/theme';
import { EyeIcon as EyeGlyph, EyeOffIcon } from './icons';

type Props = {
  /** True renders the struck-through "hidden" variant. */
  off?: boolean;
  color?: ColorValue;
  size?: number;
};

/** Show/hide-password eye, built on the shared icon set. */
export const EyeIcon = ({ off = false, color = colors.textSecondary, size = 20 }: Props) => {
  const Glyph = off ? EyeOffIcon : EyeGlyph;
  return <Glyph color={color as string} size={size} strokeWidth={1.75} />;
};
