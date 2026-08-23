import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, themedStyles } from '../../constants/theme';
import { initialsFor, paletteFor } from '../../utils/format';

type Props = {
  /** Stable seed — use the app slug so colors never change between renders. */
  seed: string;
  /** Name the initials are derived from. */
  name: string;
  size?: number;
};

/**
 * Deterministic icon stand-in until the API serves real app icons. It carries
 * a lot of the catalog's visual weight — it is on every row — so it gets the
 * same gradient + squircle treatment as a real app icon rather than a flat
 * tinted block.
 */
export const IconPlaceholder = ({ seed, name, size = 56 }: Props) => {
  const [base, light] = paletteFor(seed);
  const cornerRadius = size * 0.28;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: cornerRadius }]}>
      <LinearGradient
        colors={[base, light]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.65, y: 0.75 }}
        style={[styles.sheen, { width: size, height: size * 0.7 }]}
      />
      <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initialsFor(name)}</Text>
    </View>
  );
};

const styles = themedStyles(() => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  initials: {
    color: colors.textInverse,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
}));
