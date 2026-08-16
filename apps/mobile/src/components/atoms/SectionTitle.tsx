import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { colors, typography } from '../../constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
};

/** The one heading style used above every content section. */
export const SectionTitle = ({ children, style }: Props) => (
  <Text style={[styles.title, style]} accessibilityRole="header">
    {children}
  </Text>
);

const styles = StyleSheet.create({
  title: {
    ...typography.sectionTitle,
    color: colors.text,
  },
});
