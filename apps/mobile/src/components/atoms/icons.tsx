/**
 * The app's stroke-icon family — one coherent set built on react-native-svg
 * instead of view-composed shapes, so every glyph in the app shares the same
 * viewBox, weight and cap/join style.
 *
 * Every icon takes the same three knobs (`size`, `color`, `strokeWidth`) and
 * draws on a 24x24 grid, so swapping one icon for another never shifts
 * layout or reads as a different hand.
 */

import { type ReactNode } from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { colors } from '../../constants/theme';

export type IconProps = {
  size?: number;
  /** Defaults to the body text color — pass the token you actually want. */
  color?: string;
  strokeWidth?: number;
};

const DEFAULT_SIZE = 24;
const DEFAULT_STROKE_WIDTH = 1.75;
const DEFAULT_COLOR = colors.text;

type BaseProps = IconProps & { children: ReactNode };

/** Shared shell: viewBox, cap/join style and stroke inheritance for children. */
const Icon = ({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  children,
}: BaseProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </Svg>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <Circle cx={10.5} cy={10.5} r={6.5} />
    <Line x1={21} y1={21} x2={15.4} y2={15.4} />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <Line x1={6} y1={6} x2={18} y2={18} />
    <Line x1={18} y1={6} x2={6} y2={18} />
  </Icon>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <Polyline points="9 6 15 12 9 18" />
  </Icon>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <Polyline points="15 6 9 12 15 18" />
  </Icon>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <Polyline points="6 9 12 15 18 9" />
  </Icon>
);

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M12 3v12" />
    <Polyline points="7 11 12 16 17 11" />
    <Path d="M5 21h14" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <Polyline points="5 13 10 18 19 7" />
  </Icon>
);

export const RefreshIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M6.34 6.34a8 8 0 1 1 0 11.32" />
    <Polyline points="3.2 14.8 6.34 17.7 9.5 14.8" />
  </Icon>
);

export const ShieldIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M12 3l7 3.2v5.3c0 4.6-3 8.3-7 9.5-4-1.2-7-4.9-7-9.5V6.2L12 3z" />
  </Icon>
);

export const EyeIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
    <Circle cx={12} cy={12} r={3} />
  </Icon>
);

export const EyeOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M9.9 4.24A9.6 9.6 0 0 1 12 4c6 0 10 7 10 7a17.7 17.7 0 0 1-2.17 3.19" />
    <Path d="M6.6 6.6C4 8.2 2 11 2 11s4 7 10 7a9.5 9.5 0 0 0 4.24-1.06" />
    <Path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <Line x1={2} y1={2} x2={22} y2={22} />
  </Icon>
);

export const GridIcon = (props: IconProps) => (
  <Icon {...props}>
    <Rect x={3.5} y={3.5} width={7} height={7} rx={2} />
    <Rect x={13.5} y={3.5} width={7} height={7} rx={2} />
    <Rect x={3.5} y={13.5} width={7} height={7} rx={2} />
    <Rect x={13.5} y={13.5} width={7} height={7} rx={2} />
  </Icon>
);

export const BoxIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M12 3 20 7 12 11 4 7 12 3z" />
    <Path d="M4 7v8l8 4v-8" />
    <Path d="M20 7v8l-8 4v-8" />
  </Icon>
);

export const UserIcon = (props: IconProps) => (
  <Icon {...props}>
    <Circle cx={12} cy={8} r={3.5} />
    <Path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
  </Icon>
);

export const LogOutIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
    <Line x1={21} y1={12} x2={9} y2={12} />
    <Polyline points="16 7 21 12 16 17" />
  </Icon>
);

type StarIconProps = IconProps & {
  /** Fills the star with `color` instead of drawing it as an outline. */
  filled?: boolean;
};

export const StarIcon = ({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  filled = false,
}: StarIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.6-5.9-3.2-5.9 3.2 1.2-6.6-4.8-4.6 6.6-.9L12 2.6z"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  </Svg>
);

export const AlertIcon = ({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  strokeWidth = DEFAULT_STROKE_WIDTH,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3.4 21.6 20H2.4L12 3.4z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <Line x1={12} y1={9.5} x2={12} y2={13.3} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Circle cx={12} cy={16.4} r={0.9} fill={color} stroke="none" />
  </Svg>
);

export const InfoIcon = ({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  strokeWidth = DEFAULT_STROKE_WIDTH,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={strokeWidth} />
    <Line x1={12} y1={11} x2={12} y2={16.2} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Circle cx={12} cy={7.6} r={0.9} fill={color} stroke="none" />
  </Svg>
);

export const SparkleIcon = ({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  strokeWidth = DEFAULT_STROKE_WIDTH,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2.4l1.9 6.3 6.3 1.9-6.3 1.9-1.9 6.3-1.9-6.3-6.3-1.9 6.3-1.9L12 2.4z"
      fill={color}
      stroke={color}
      strokeWidth={strokeWidth * 0.3}
      strokeLinejoin="round"
    />
  </Svg>
);

export const ArrowUpRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <Line x1={7} y1={17} x2={17} y2={7} />
    <Polyline points="8 7 17 7 17 16" />
  </Icon>
);
