import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../constants/theme';

type Tone = 'accent' | 'muted';

type Props = {
  label: string;
  tone?: Tone;
};

/** Small standalone pill for a free-form label (StatusPill is domain-typed). */
export const Badge = ({ label, tone = 'accent' }: Props) => (
  <View style={[styles.badge, toneStyles[tone]]}>
    <Text style={[styles.label, toneText[tone]]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  label: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.4,
  },
});

const toneStyles = StyleSheet.create({
  accent: { backgroundColor: colors.accentSoft },
  muted: { backgroundColor: colors.surfaceMuted },
});

const toneText = StyleSheet.create({
  accent: { color: colors.accent },
  muted: { color: colors.textSecondary },
});
