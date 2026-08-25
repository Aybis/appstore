import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors, themedStyles, typography } from '../../constants/theme';

type Props = {
  size?: number;
  /** Renders the "MAYA" wordmark under the icon. */
  withWordmark?: boolean;
  style?: StyleProp<ViewStyle>;
};

const VIEWBOX = 96;

/**
 * MAYA's mark: the MM monogram, cream on ink, in a rounded square.
 *
 * THIS IS THE APP ICON, redrawn. It used to be something else entirely — three
 * ascending bars knocked out of a coral gradient — which meant the launcher
 * showed one logo, the system splash showed a second, and the app itself showed
 * a third. Whatever the merits of the bars, a store whose own branding changes
 * twice before you reach the sign-in screen is not reassuring.
 *
 * The geometry is measured from assets/icon.png rather than eyeballed: the
 * squircle's corner radius is 18.75% of its width, the stems sit at 15.6% and
 * 84.5%, all three peaks are level, and the stroke is 10% of the width with
 * round caps. Drawn as a vector rather than the PNG so it stays crisp at any
 * size — and because the PNG's corners are opaque white, which would show as a
 * white card on the dark splash.
 *
 * Deliberately NOT themed. Cream and ink are the brand's own colours, the same
 * ones on the home screen; a logo that changes colour with the OS is a logo
 * somebody has to look twice at.
 */
const CREAM = '#FFF6EC';
const INK = '#1A1815';

/** The monogram's centre line. Two Ms sharing their middle peak. */
const MONOGRAM =
  'M15 79.5 L15 26.9 L31.5 47 L48 26.9 L64.6 47 L81.1 26.9 L81.1 79.5';

export const MayaMark = ({ size = 64, withWordmark = false, style }: Props) => (
  <View style={[styles.container, style]}>
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      accessible
      accessibilityLabel="MAYA"
    >
      <Rect
        x={0}
        y={0}
        width={VIEWBOX}
        height={VIEWBOX}
        rx={VIEWBOX * 0.1875}
        fill={CREAM}
      />
      <Path
        d={MONOGRAM}
        stroke={INK}
        strokeWidth={9.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
    {withWordmark && <Text style={styles.wordmark}>MAYA</Text>}
  </View>
);

const styles = themedStyles(() => ({
  container: {
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    ...typography.title,
    letterSpacing: 6,
    color: colors.text,
  },
}));
