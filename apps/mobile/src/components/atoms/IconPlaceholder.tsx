import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../constants/theme';
import { initialsFor, paletteFor } from '../../utils/format';

type Props = {
  /** Stable seed — use the app slug so colors never change between renders. */
  seed: string;
  /** Name the initials are derived from. */
  name: string;
  size?: number;
};

/**
 * Deterministic icon stand-in until the API serves real app icons.
 * Two-tone block + initials, no image loading, works offline.
 */
export const IconPlaceholder = ({ seed, name, size = 56 }: Props) => {
  const [base, light] = paletteFor(seed);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size * 0.26,
          backgroundColor: base,
        },
      ]}
    >
      <View
        style={[
          styles.sheen,
          { backgroundColor: light, height: size, width: size * 0.9 },
        ]}
      />
      <Text style={[styles.initials, { fontSize: size * 0.34 }]}>
        {initialsFor(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: '55%',
    left: '-25%',
    opacity: 0.45,
    transform: [{ rotate: '-24deg' }],
    borderRadius: radius.sm,
  },
  initials: {
    color: colors.textInverse,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
