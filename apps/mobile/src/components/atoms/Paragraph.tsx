import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { colors, themedStyles, typography } from '../../constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

/**
 * Body copy — the readable-width text used inside sections.
 *
 * Dark-mode body text needs more air than light mode to stay comfortable, so
 * line height runs at ~1.5x the type size rather than the tighter ratio a
 * heading can get away with.
 */
export const Paragraph = ({ children, style, numberOfLines }: Props) => (
  <Text style={[styles.body, style]} numberOfLines={numberOfLines}>
    {children}
  </Text>
);

const styles = themedStyles(() => ({
  body: {
    ...typography.body,
    lineHeight: Math.round(typography.body.fontSize * 1.5),
    color: colors.textSecondary,
  },
}));
