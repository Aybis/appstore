import { Children, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { colors, radius, spacing, themedStyles, typography } from '../../theme/tokens';

type Props = {
  title: string;
  children: ReactNode;
};

/**
 * A titled, rounded card of SettingsRows with hairlines between them: the
 * grouped-list pattern of a phone's own settings, so Profile reads as a menu
 * rather than a long form.
 */
export const SettingsGroup = ({ title, children }: Props) => {
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.group}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>
        {rows.map((row, index) => (
          <View key={index} style={index > 0 ? styles.divided : undefined}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = themedStyles(() => ({
  group: {
    gap: spacing.sm,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
    paddingHorizontal: spacing.xs,
  },
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  divided: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
}));
