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
    // A little air for the rare heading that wraps (a long app name); tight
    // negative tracking with a single-line lineHeight reads as clipped.
    lineHeight: Math.round(typography.title.fontSize * 1.25),
    color: colors.text,
  },
});
