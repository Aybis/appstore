import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../constants/theme';

type Props = { children: ReactNode };

/** Full-screen shell for a single state message (loading, error, not found). */
export const CenteredTemplate = ({ children }: Props) => (
  <View style={styles.screen}>{children}</View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
