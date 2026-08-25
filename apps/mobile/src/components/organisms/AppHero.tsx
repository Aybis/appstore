import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { canvasFade, colors, gradients, radius, shadow, spacing, themedStyles, typography } from '../../constants/theme';
import { FadeIn } from '../../motion';
import { IconPlaceholder, StatusPill, Title } from '../atoms';
import { RatingStars } from '../molecules';
import type { App } from '../../types';

type Props = { app: App };

const ICON_SIZE = 92;
/** Radius the wash fades over — enough that it dissolves before the next section, not a hard line. */
const WASH_TINT_OPACITY = 0.55;

/** Icon, name, publisher, rating and access state at the top of the detail screen. */
export const AppHero = ({ app }: Props) => (
  <FadeIn style={styles.wash}>
    {/*
     * Two stacked gradients: brandDeep gives the top of the screen a light
     * source, canvasFade dissolves it back into the canvas before the hero's
     * own bottom edge — so whatever renders below never meets a hard seam.
     */}
    <LinearGradient
      colors={[...gradients.brandDeep]}
      start={{ x: 0.05, y: 0 }}
      end={{ x: 0.95, y: 0.75 }}
      style={[StyleSheet.absoluteFill, styles.washTint]}
    />
    <LinearGradient
      colors={[...canvasFade()]}
      start={{ x: 0.5, y: 0.1 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    />

    <View style={styles.hero}>
      <View style={styles.iconLift}>
        <IconPlaceholder seed={app.slug} name={app.name} size={ICON_SIZE} />
      </View>
      <View style={styles.text}>
        <Title style={styles.name}>{app.name}</Title>
        <Text style={styles.publisher}>{app.publisher}</Text>
        <View style={styles.meta}>
          <RatingStars rating={app.rating} count={app.ratingCount} />
          <StatusPill status={app.accessStatus} />
        </View>
      </View>
    </View>
  </FadeIn>
);

const styles = themedStyles(() => ({
  wash: {
    overflow: 'hidden',
    // Bleeds past the screen's own horizontal/top padding so the wash reads
    // as a light source at the very edge of the device, not an inset panel.
    marginHorizontal: -spacing.xl,
    marginTop: -spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.xl,
  },
  washTint: {
    opacity: WASH_TINT_OPACITY,
  },
  hero: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  iconLift: {
    borderRadius: radius.xl,
    ...shadow.card,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    fontSize: typography.display.fontSize,
    fontWeight: typography.display.fontWeight,
    letterSpacing: typography.display.letterSpacing,
    lineHeight: Math.round(typography.display.fontSize * 1.15),
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
}));
