import { memo } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { colors, radius, spacing, themedStyles, typography } from '../../theme/tokens';
import { AppIcon } from '../atoms';
import { PressableScale } from '../../motion';
import { useTheme } from '../../theme';
import type { App } from '../../types';

type Props = {
  app: App;
  /** 1-based position in the ranking. */
  rank: number;
};

/** A "Top 10" tile: the position as an oversized numeral beside the app. */
const RankCardTile = ({ app, rank }: Props) => {
  const router = useRouter();
  useTheme();

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/app/[slug]', params: { slug: app.slug } })}
      scaleTo="card"
      accessibilityRole="button"
      accessibilityLabel={`Number ${rank}, ${app.name}`}
      style={styles.card}
    >
      <Text style={styles.rank} accessibilityElementsHidden>
        {rank}
      </Text>
      <View style={styles.app}>
        <AppIcon app={app} size={84} />
        <Text style={styles.name} numberOfLines={1}>
          {app.name}
        </Text>
        <Text style={styles.category} numberOfLines={1}>
          {app.category}
        </Text>
      </View>
    </PressableScale>
  );
};

export const RankCard = memo(RankCardTile);

const styles = themedStyles(() => ({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: 168,
  },
  rank: {
    fontSize: 88,
    lineHeight: 96,
    fontWeight: '900',
    letterSpacing: -6,
    color: colors.textTertiary,
    marginRight: -6,
  },
  app: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: 2,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.text,
    marginTop: spacing.xs,
  },
  category: {
    ...typography.caption,
    color: colors.textSecondary,
  },
}));
