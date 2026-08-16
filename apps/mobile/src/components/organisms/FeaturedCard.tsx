import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  colors,
  radius,
  shadow,
  spacing,
  typography,
} from '../../constants/theme';
import { paletteFor } from '../../utils/format';
import { IconPlaceholder } from '../atoms';
import { RatingStars } from '../molecules';
import type { App } from '../../types';

type Props = { app: App; width: number };

/** Wide card for the horizontal "Featured" rail (FR-1.6). */
export const FeaturedCard = ({ app, width }: Props) => {
  const [base, light] = paletteFor(app.slug);

  return (
    <Link href={{ pathname: '/app/[slug]', params: { slug: app.slug } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Featured: ${app.name}`}
        style={({ pressed }) => [
          styles.card,
          shadow.card,
          { width },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.banner, { backgroundColor: base }]}>
          <View style={[styles.bannerSheen, { backgroundColor: light }]} />
          <Text style={styles.bannerLabel}>FEATURED</Text>
        </View>

        <View style={styles.body}>
          <IconPlaceholder seed={app.slug} name={app.name} size={48} />
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>
              {app.name}
            </Text>
            <Text style={styles.tagline} numberOfLines={2}>
              {app.tagline}
            </Text>
            <RatingStars rating={app.rating} count={app.ratingCount} size={12} />
          </View>
        </View>
      </Pressable>
    </Link>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  banner: {
    height: 86,
    justifyContent: 'flex-end',
    padding: spacing.md,
    overflow: 'hidden',
  },
  bannerSheen: {
    position: 'absolute',
    top: -30,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.45,
  },
  bannerLabel: {
    ...typography.label,
    color: colors.textInverse,
    letterSpacing: 1.2,
    opacity: 0.95,
  },
  body: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  tagline: {
    ...typography.caption,
    color: colors.textSecondary,
    minHeight: 34,
  },
});
