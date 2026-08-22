import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../constants/theme';
import { SectionTitle } from '../atoms';
import { FadeIn, PressableScale } from '../../motion';

type Props = {
  title: string;
  children: ReactNode;
  /** Optional right-aligned action in the title row, e.g. "See all". */
  actionLabel?: string;
  onActionPress?: () => void;
};

/** Titled block used down the detail screen. Fades and rises in as a unit. */
export const Section = ({ title, children, actionLabel, onActionPress }: Props) => (
  <FadeIn style={styles.section}>
    <View style={styles.titleRow}>
      <SectionTitle>{title}</SectionTitle>
      {actionLabel && onActionPress && (
        <PressableScale
          onPress={onActionPress}
          scaleTo="control"
          haptic="tap"
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.action}>{actionLabel}</Text>
        </PressableScale>
      )}
    </View>
    {children}
  </FadeIn>
);

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  action: {
    ...typography.bodyStrong,
    color: colors.accent,
  },
});
