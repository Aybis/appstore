import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles, typography } from '../../constants/theme';
import { useT } from '../../i18n';
import type { App } from '../../types';

type Props = { track: App['track'] };

/**
 * Marks a build the rest of the company cannot see yet.
 *
 * Renders NOTHING for `production`, which is the overwhelming majority of what
 * anybody looks at. A badge on every row is wallpaper; a badge that appears
 * only on the two or three builds you are testing is information.
 *
 * The colour is `highlight` — the one accent the interface spends on state —
 * for the same reason the current tab uses it: this is the one thing on the
 * screen that is unusual.
 */
export const TrackPill = ({ track }: Props) => {
  const t = useT();
  if (!track || track === 'production') return null;

  return (
    <View style={styles.pill}>
      <Text style={styles.label}>
        {track === 'internal' ? t('track.internal') : t('track.beta')}
      </Text>
    </View>
  );
};

const styles = themedStyles(() => ({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.highlightSoft,
  },
  label: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.highlight,
  },
}));
