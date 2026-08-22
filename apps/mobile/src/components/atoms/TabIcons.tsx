import type { ColorValue } from 'react-native';

import { colors } from '../../constants/theme';
import { DownloadIcon, GridIcon, UserIcon } from './icons';

type Props = {
  /** ColorValue, not string — React Navigation passes an opaque color. */
  color: ColorValue;
  size?: number;
};

const DEFAULT_SIZE = 24;

/**
 * Tab bar glyphs built on the shared icon set. React Navigation hands us the
 * active/inactive tint but never an "active" boolean, so a heavier stroke on
 * the accent color is what carries the filled/active feel.
 */
const strokeWidthFor = (color: ColorValue): number =>
  color === colors.accent ? 2.15 : 1.75;

/** Four-tile grid — the catalog / app-grid mark. */
export const DiscoverIcon = ({ color, size = DEFAULT_SIZE }: Props) => (
  <GridIcon color={color as string} size={size} strokeWidth={strokeWidthFor(color)} />
);

/** Arrow into a tray — the "installed / downloaded" mark. */
export const MyAppsIcon = ({ color, size = DEFAULT_SIZE }: Props) => (
  <DownloadIcon color={color as string} size={size} strokeWidth={strokeWidthFor(color)} />
);

/** Head and shoulders. */
export const ProfileIcon = ({ color, size = DEFAULT_SIZE }: Props) => (
  <UserIcon color={color as string} size={size} strokeWidth={strokeWidthFor(color)} />
);
