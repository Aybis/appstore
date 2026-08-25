import { type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, themedStyles, typography } from '../../constants/theme';
import { FadeIn } from '../../motion';
import { AlertIcon, CheckIcon, InfoIcon, type IconProps } from '../atoms';

type Tone = 'info' | 'success' | 'warning' | 'danger';

type Props = {
  title: string;
  body: string;
  /** Status the banner communicates — selects fill, text colour and icon. */
  tone?: Tone;
};

const ICON: Record<Tone, ComponentType<IconProps>> = {
  info: InfoIcon,
  success: CheckIcon,
  warning: AlertIcon,
  danger: AlertIcon,
};

/** Inline banner on a soft status fill, with the icon that matches its tone. */
export const Notice = ({ title, body, tone = 'info' }: Props) => {
  const Glyph = ICON[tone];
  const toneColor = textToneFor(tone);

  return (
    <FadeIn style={[styles.notice, toneStyles[tone]]}>
      <Glyph size={18} color={toneColor} strokeWidth={1.9} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: toneColor }]}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </FadeIn>
  );
};

const styles = themedStyles(() => ({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.bodyStrong,
  },
  body: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
}));

const toneStyles = themedStyles(() => ({
  info: { backgroundColor: colors.accentSoft },
  success: { backgroundColor: colors.successSoft },
  warning: { backgroundColor: colors.warningSoft },
  danger: { backgroundColor: colors.dangerSoft },
}));

/*
 * A FUNCTION, not a record. `colors` is a proxy that resolves against whichever
 * palette is active AT THE MOMENT A PROPERTY IS READ — so a module-level object
 * literal reads it once, at import, and freezes that scheme's values forever.
 * This app starts dark, so the frozen value was the dark one, and after a switch
 * to light it painted light text on a light fill. Reading inside a call keeps it
 * honest.
 */
const textToneFor = (tone: Tone): string =>
  ({
    info: colors.accent,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  })[tone];
