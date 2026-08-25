import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { gradients, radius, shadow, spacing, themedStyles, typography } from '../../constants/theme';
import { ArrowUpRightIcon, IconPlaceholder } from '../atoms';
import { RatingStars } from '../molecules';
import { PressableScale } from '../../motion';
import type { App } from '../../types';

type Props = {
  app: App;
  width: number;
  /** Position within the FeaturedRail — enables the leave-centre scale/fade. */
  index?: number;
  /** Shared scroll offset from FeaturedRail's Reanimated scroll handler. */
  scrollX?: SharedValue<number>;
  /** Distance between snap points. Defaults to `width` when used standalone. */
  snapInterval?: number;
};

const CARD_HEIGHT = 232;

/** Showpiece card for the horizontal "Featured" rail (FR-1.6). */
export const FeaturedCard = ({ app, width, index = 0, scrollX, snapInterval }: Props) => {
  const router = useRouter();
  // Falls back to a shared value that never moves, so the interpolation below
  // degrades to an identity transform when the card is used outside a rail.
  const fallbackScrollX = useSharedValue(0);
  const offset = scrollX ?? fallbackScrollX;
  const interval = snapInterval ?? width;

  const parallaxStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * interval, index * interval, (index + 1) * interval];
    return {
      transform: [
        { scale: interpolate(offset.value, inputRange, [0.94, 1, 0.94], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(offset.value, inputRange, [0.72, 1, 0.72], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View style={[{ width }, parallaxStyle]}>
      <PressableScale
        onPress={() =>
          router.push({ pathname: '/app/[slug]', params: { slug: app.slug } })
        }
        scaleTo="card"
        haptic="tap"
        accessibilityRole="button"
        accessibilityLabel={`Featured: ${app.name}`}
        style={[styles.card, shadow.card]}
      >
        <LinearGradient
          colors={[...gradients.brandDeep]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Soft light source in the upper corner — the "radial" sheen, faked
            with a diagonal gradient since expo-linear-gradient has no radial mode. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 0.6 }}
          style={styles.sheen}
          pointerEvents="none"
        />
        {/* Guarantees the bottom text stack stays legible regardless of where
            the brand gradient's light end lands for a given card width. */}
        <LinearGradient
          colors={[...gradients.imageScrim]}
          style={styles.scrim}
          pointerEvents="none"
        />

        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>FEATURED</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.iconMount}>
            <IconPlaceholder seed={app.slug} name={app.name} size={52} />
          </View>

          <Text style={styles.name} numberOfLines={1}>
            {app.name}
          </Text>
          <Text style={styles.tagline} numberOfLines={2}>
            {app.tagline}
          </Text>
          <RatingStars rating={app.rating} count={app.ratingCount} size={12} />

          <View style={styles.cta}>
            <Text style={styles.ctaLabel}>View</Text>
            <ArrowUpRightIcon size={14} color={ON_GRADIENT_INK} strokeWidth={2.4} />
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
};

/*
 * Fixed colours, not palette tokens, for everything drawn ON the gradient.
 *
 * `gradients.brandDeep` is the same deep maroon in both schemes — it does not
 * theme. Anything painted on top of it therefore must not theme either, and
 * the tokens used here previously did: in dark, `colors.text` resolved to
 * near-white and the card read correctly, and in light it resolved to
 * near-black and put dark text on a dark red ground.
 *
 * That mismatch was invisible until the memoisation bug above was fixed, which
 * is the only reason the card ever repainted at all.
 */
const ON_GRADIENT = '#FFFFFF';
const ON_GRADIENT_MUTED = 'rgba(255,255,255,0.78)';
const ON_GRADIENT_INK = '#1A1815';

const styles = themedStyles(() => ({
  card: {
    height: CARD_HEIGHT,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
  },
  badge: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: ON_GRADIENT,
  },
  badgeLabel: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 1,
    color: ON_GRADIENT_INK,
  },
  body: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    gap: 4,
  },
  iconMount: {
    alignSelf: 'flex-start',
    padding: 4,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  name: {
    ...typography.title,
    color: ON_GRADIENT,
  },
  tagline: {
    ...typography.caption,
    color: ON_GRADIENT_MUTED,
    minHeight: 34,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: ON_GRADIENT,
  },
  ctaLabel: {
    ...typography.label,
    fontWeight: '700',
    color: ON_GRADIENT_INK,
  },
}));
