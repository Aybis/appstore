import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { colors, typography } from '../../constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
};

/** De-emphasised supporting line — timestamps, footnotes, counts. */
export const Caption = ({ children, style }: Props) => (
  <Text style={[styles.caption, style]}>{children}</Text>
);

const styles = StyleSheet.create({
  caption: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
