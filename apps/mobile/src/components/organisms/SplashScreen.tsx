import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { colors, themedStyles } from '../../constants/theme';
import { MayaIntro } from './MayaIntro';

/**
 * The first thing the app shows: the mark springs in, a sheen sweeps it, and
 * the wordmark letters stagger in after.
 *
 * MayaIntro's entrance runs to roughly 750ms — the mark settles at ~480ms and
 * the fourth letter lands ~270ms after that. Session restore usually finishes
 * well before then, so without a floor the animation would be cut off partway
 * on a fast device and the brand moment would read as a flicker.
 */
const ENTRANCE_MS = 1500;

/**
 * True once the splash has been up long enough to have shown its animation.
 *
 * Runs alongside session restore rather than after it, so the wait is the
 * LONGER of the two rather than their sum — a slow restore costs nothing extra,
 * and a fast one still gets a whole animation.
 */
export const useSplashFloor = (): boolean => {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setElapsed(true), ENTRANCE_MS);
    return () => clearTimeout(id);
  }, []);

  return elapsed;
};

export const SplashScreen = () => (
  <View style={styles.screen}>
    <MayaIntro size={96} />
  </View>
);

const styles = themedStyles(() => ({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
}));
