import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { colors, typography } from '../../constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
};

/** Body copy — the readable-width text used inside sections. */
export const Paragraph = ({ children, style }: Props) => (
  <Text style={[styles.body, style]}>{children}</Text>
);

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    lineHeight: 23,
    color: colors.textSecondary,
  },
});
