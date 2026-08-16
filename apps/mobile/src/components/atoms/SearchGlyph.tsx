import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../../constants/theme';

/** Magnifier drawn from primitives — avoids pulling in an icon package. */
export const SearchGlyph = () => (
  <View style={styles.glyph}>
    <View style={styles.lens} />
    <View style={styles.handle} />
  </View>
);

const styles = StyleSheet.create({
  glyph: {
    width: 16,
    height: 16,
    justifyContent: 'center',
  },
  lens: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.6,
    borderColor: colors.textTertiary,
  },
  handle: {
    position: 'absolute',
    right: 0,
    bottom: 1,
    width: 6,
    height: 1.6,
    borderRadius: radius.sm,
    backgroundColor: colors.textTertiary,
    transform: [{ rotate: '45deg' }],
  },
});
