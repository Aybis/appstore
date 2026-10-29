import { memo } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius, spacing, themedStyles, typography } from '../../theme/tokens';
import { paletteFor } from '../../utils/format';
import { AppIcon } from '../atoms';
import { RatingStars } from '../molecules';
import { PressableScale } from '../../motion';
import { useTheme } from '../../theme';
import type { App } from '../../types';

type Props = {
  app: App;
  width?: number;
};

/**
 * Portrait tile for the streaming-style rails: the app's icon large on its own
 * colour wash, name and category underneath. Tapping opens the detail page;
 * install stays on the detail page and the list rows, so a tile is for
 * browsing rather than another button to mis-tap.
 */
const PosterCardTile = ({ app, width = 132 }: Props) => {
  const router = useRouter();
  // Same reason as AppCard: memo does not block context, so the palette still reaches us.
  useTheme();
  const [base, light] = paletteFor(app.slug);

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/app/[slug]', params: { slug: app.slug } })}
      scaleTo="card"
      accessibilityRole="button"
      accessibilityLabel={`${app.name}, ${app.category}, rated ${app.rating.toFixed(1)}`}
      style={{ width }}
    >
      <View style={[styles.poster, { width, height: width * 1.2 }]}>
        <LinearGradient
          colors={[`${base}55`, `${light}22`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        />
        <AppIcon app={app} size={Math.round(width * 0.62)} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {app.name}
      </Text>
      <View style={styles.meta}>
        <RatingStars rating={app.rating} size={11} starsOnly />
        <Text style={styles.category} numberOfLines={1}>
          {app.category}
        </Text>
      </View>
    </PressableScale>
  );
};

export const PosterCard = memo(PosterCardTile);

const styles = themedStyles(() => ({
  poster: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.text,
    marginTop: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  category: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
}));
