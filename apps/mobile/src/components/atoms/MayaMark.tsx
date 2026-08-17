import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, typography } from '../../constants/theme';

type Props = {
  size?: number;
  /** Renders the "MAYA" wordmark under the icon. */
  withWordmark?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The MAYA app icon, reused in-product so the store looks like the thing on the
 * user's home screen. Sourced from the same asset the launcher icon is built
 * from, so brand changes land in one place.
 */
export const MayaMark = ({ size = 64, withWordmark = false, style }: Props) => (
  <View style={[styles.container, style]}>
    <Image
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      source={require('../../../assets/icon.png')}
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
      resizeMode="contain"
      accessibilityLabel="MAYA"
    />
    {withWordmark && <Text style={styles.wordmark}>MAYA</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    ...typography.title,
    letterSpacing: 6,
    color: colors.text,
  },
});
