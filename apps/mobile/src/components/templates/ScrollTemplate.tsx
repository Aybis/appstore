import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { colors, spacing } from '../../constants/theme';

type Props = { children: ReactNode };

/** Plain scrolling page with the standard gutter — used by static screens. */
export const ScrollTemplate = ({ children }: Props) => (
  <ScrollView
    style={styles.screen}
    contentContainerStyle={styles.content}
    showsVerticalScrollIndicator={false}
  >
    {children}
  </ScrollView>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
});
