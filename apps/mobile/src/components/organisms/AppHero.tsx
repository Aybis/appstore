import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';
import { IconPlaceholder, StatusPill, Title } from '../atoms';
import { RatingStars } from '../molecules';
import type { App } from '../../types';

type Props = { app: App };

/** Icon, name, publisher, rating and access state at the top of the detail screen. */
export const AppHero = ({ app }: Props) => (
  <View style={styles.hero}>
    <IconPlaceholder seed={app.slug} name={app.name} size={84} />
    <View style={styles.text}>
      <Title>{app.name}</Title>
      <Text style={styles.publisher}>{app.publisher}</Text>
      <View style={styles.meta}>
        <RatingStars rating={app.rating} count={app.ratingCount} />
        <StatusPill status={app.accessStatus} />
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  publisher: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
});
