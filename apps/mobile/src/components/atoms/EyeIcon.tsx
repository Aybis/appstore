import { StyleSheet, View, type ColorValue } from 'react-native';
import { colors } from '../../constants/theme';

type Props = {
  /** True renders the struck-through "hidden" variant. */
  off?: boolean;
  color?: ColorValue;
  size?: number;
};

/**
 * Show/hide-password eye, drawn from primitives like SearchGlyph and the tab
 * icons — this app ships no icon font.
 */
export const EyeIcon = ({ off = false, color = colors.textSecondary, size = 20 }: Props) => (
  <View style={[styles.box, { width: size, height: size }]}>
    <View
      style={{
        width: size * 0.92,
        height: size * 0.6,
        borderRadius: size * 0.3,
        borderWidth: 1.6,
        borderColor: color,
      }}
    />
    <View
      style={{
        position: 'absolute',
        width: size * 0.28,
        height: size * 0.28,
        borderRadius: size * 0.14,
        backgroundColor: color,
      }}
    />
    {off && (
      <View
        style={{
          position: 'absolute',
          width: size * 1.06,
          height: 1.8,
          borderRadius: 1,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    )}
  </View>
);

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
