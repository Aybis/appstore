import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { colors, themedStyles } from '../../theme/tokens';

type Props = {
  icon: LucideIcon;
  /** The box the art fills; the rings are sized to its shorter side. */
  width: number;
  height: number;
};

/**
 * A slide's or screen's artwork: one Lucide icon inside two soft coral rings.
 *
 * Replaces the unDraw illustrations. An icon says what the screen is about at
 * a glance, follows the theme through the palette, and is one line to change.
 */
export const IconArt = ({ icon: Icon, width, height }: Props) => {
  const outer = Math.min(width, height) * 0.78;
  const inner = outer * 0.68;

  return (
    <View style={[styles.box, { width, height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.ring, { width: outer, height: outer, borderRadius: outer / 2 }]}>
        <View style={[styles.core, { width: inner, height: inner, borderRadius: inner / 2 }]}>
          <Icon size={inner * 0.46} color={colors.highlight} strokeWidth={1.75} />
        </View>
      </View>
    </View>
  );
};

const styles = themedStyles(() => ({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.highlightSoft,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.highlightSoft,
  },
}));
