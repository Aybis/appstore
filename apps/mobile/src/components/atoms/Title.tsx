import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { colors, typography } from '../../constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
};

/** Screen-level heading. */
export const Title = ({ children, style }: Props) => (
  <Text style={[styles.title, style]} accessibilityRole="header">
    {children}
  </Text>
);

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
  },
});
