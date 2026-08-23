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

  return (
    <FadeIn style={[styles.notice, toneStyles[tone]]}>
      <Glyph size={18} color={textTone[tone]} strokeWidth={1.9} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: textTone[tone] }]}>{title}</Text>
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

const textTone: Record<Tone, string> = {
  info: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};
