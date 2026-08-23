import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors, gradients, themedStyles, typography } from '../../constants/theme';

type Props = {
  size?: number;
  /** Renders the "MAYA" wordmark under the icon. */
  withWordmark?: boolean;
  style?: StyleProp<ViewStyle>;
};

const VIEWBOX = 96;

/**
 * MAYA's mark: three ascending bars knocked out of a lavender gradient
 * squircle — a top-charts silhouette, which is what a store's own mark should
 * gesture at. Drawn as one vector on a fixed viewBox rather than a raster
 * asset, so it stays crisp from a 24px tab glyph up to a 96px intro mark.
 */
export const MayaMark = ({ size = 64, withWordmark = false, style }: Props) => (
  <View style={[styles.container, style]}>
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      accessible
      accessibilityLabel="MAYA"
    >
      <Defs>
        <LinearGradient id="mayaMarkFill" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={gradients.brand[0]} />
          <Stop offset="0.55" stopColor={gradients.brand[1]} />
          <Stop offset="1" stopColor={gradients.brand[2]} />
        </LinearGradient>
      </Defs>
      <Rect
        x={0}
        y={0}
        width={VIEWBOX}
        height={VIEWBOX}
        rx={VIEWBOX * 0.28}
        fill="url(#mayaMarkFill)"
      />
      <Rect x={23} y={48} width={13} height={22} rx={6.5} fill={colors.background} />
      <Rect x={41.5} y={36} width={13} height={34} rx={6.5} fill={colors.background} />
      <Rect x={60} y={26} width={13} height={44} rx={6.5} fill={colors.background} />
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
