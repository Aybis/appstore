import { StyleSheet, View, type ColorValue } from 'react-native';

type Props = {
  /** ColorValue, not string — React Navigation passes an opaque color. */
  color: ColorValue;
  size?: number;
};

const DEFAULT_SIZE = 24;

/**
 * Tab bar glyphs drawn from primitives, matching SearchGlyph — the app ships
 * no icon font, so every mark here is composed of plain Views.
 */

/** Four rounded tiles — the catalog / app-grid mark. */
export const DiscoverIcon = ({ color, size = DEFAULT_SIZE }: Props) => {
  const gap = size * 0.16;
  const tile = (size - gap) / 2;

  return (
    <View style={[styles.box, { width: size, height: size, gap }]}>
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          style={{
            width: tile,
            height: tile,
            borderRadius: tile * 0.3,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
};

/** Down-chevron onto a baseline — the "installed / downloaded" mark. */
export const MyAppsIcon = ({ color, size = DEFAULT_SIZE }: Props) => (
  <View style={{ width: size, height: size }}>
    <View
      style={{
        position: 'absolute',
        left: size * 0.46,
        top: size * 0.06,
        width: size * 0.08,
        height: size * 0.4,
        borderRadius: size * 0.04,
        backgroundColor: color,
      }}
    />
    <View
      style={{
        position: 'absolute',
        alignSelf: 'center',
        top: size * 0.24,
        width: size * 0.32,
        height: size * 0.32,
        borderRightWidth: size * 0.09,
        borderBottomWidth: size * 0.09,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
    <View
      style={{
        position: 'absolute',
        left: size * 0.14,
        bottom: size * 0.06,
        width: size * 0.72,
        height: size * 0.09,
        borderRadius: size * 0.045,
        backgroundColor: color,
      }}
    />
  </View>
);

/** Head and shoulders. */
export const ProfileIcon = ({ color, size = DEFAULT_SIZE }: Props) => (
  <View style={[styles.column, { width: size, height: size }]}>
    <View
      style={{
        width: size * 0.38,
        height: size * 0.38,
        borderRadius: size * 0.19,
        backgroundColor: color,
        marginTop: size * 0.06,
      }}
    />
    <View
      style={{
        width: size * 0.74,
        height: size * 0.34,
        borderTopLeftRadius: size * 0.37,
        borderTopRightRadius: size * 0.37,
        backgroundColor: color,
        marginTop: size * 0.08,
      }}
    />
  </View>
);

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  column: {
    alignItems: 'center',
  },
});
