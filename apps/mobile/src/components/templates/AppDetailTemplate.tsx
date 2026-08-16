import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../constants/theme';

/** Height reserved so the last section clears the pinned footer. */
const FOOTER_CLEARANCE = 110;

type Props = {
  children: ReactNode;
  /** Pinned to the bottom, outside the scroll area. */
  footer: ReactNode;
  bottomInset: number;
};

/** Detail page skeleton: scrolling content with a pinned action bar. */
export const AppDetailTemplate = ({ children, footer, bottomInset }: Props) => (
  <View style={styles.screen}>
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomInset + FOOTER_CLEARANCE },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
    {footer}
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
});
