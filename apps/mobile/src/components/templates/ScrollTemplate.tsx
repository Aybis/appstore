import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { colors, spacing } from '../../constants/theme';
import { FadeIn } from '../../motion';

type Props = {
  children: ReactNode;
  /** Extra bottom clearance — pass insets.bottom on a screen sitting under
   * the floating glass tab bar. Defaults to 0 for screens that don't need it. */
  bottomInset?: number;
};

/** Plain scrolling page with the standard gutter — used by static screens. */
export const ScrollTemplate = ({ children, bottomInset = 0 }: Props) => (
  <ScrollView
    style={styles.screen}
    contentContainerStyle={[
      styles.content,
      { paddingBottom: spacing.xl + bottomInset },
    ]}
    showsVerticalScrollIndicator={false}
  >
    <FadeIn style={styles.body} translateY={spacing.lg}>
      {children}
    </FadeIn>
  </ScrollView>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
  },
  // The gap lives here rather than on `content`: children are now wrapped in
  // one FadeIn, so it is this View — not the scroll content container — that
  // holds every section as a direct child.
  body: {
    gap: spacing.lg,
  },
});
