import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles, typography } from '../../constants/theme';
import { FadeIn } from '../../motion';

type Props = {
  /** Spinner, badge, or illustration shown above the text. */
  media?: ReactNode;
  title?: string;
  body?: string;
  action?: ReactNode;
};

/**
 * Shared shell for the loading / error / empty states so all three sit at the
 * same optical position and share one set of spacing rules (NFR-7).
 */
export const StateMessage = ({ media, title, body, action }: Props) => (
  <FadeIn style={styles.container}>
    {media}
    {title ? <Text style={styles.title}>{title}</Text> : null}
    {body ? <Text style={styles.body}>{body}</Text> : null}
    {action}
  </FadeIn>
);

const BADGE_SIZE = 64;

type IconBadgeTone = 'accent' | 'danger';

type IconBadgeProps = {
  tone: IconBadgeTone;
  children: ReactNode;
};

/**
 * The soft tinted circle behind a state glyph. Shared by EmptyState and
 * ErrorState so "calm, centred, tinted circle above the text" stays one
 * definition instead of two copies drifting apart.
 */
export const IconBadge = ({ tone, children }: IconBadgeProps) => (
  <View style={[styles.badge, badgeTone[tone]]}>{children}</View>
);

const styles = themedStyles(() => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  body: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
}));

const badgeTone = themedStyles(() => ({
  accent: { backgroundColor: colors.accentSoft },
  danger: { backgroundColor: colors.dangerSoft },
}));
