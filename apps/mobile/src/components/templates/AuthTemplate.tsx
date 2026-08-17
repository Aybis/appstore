import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { colors, spacing } from '../../constants/theme';
import { MayaMark, Paragraph, Title } from '../atoms';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the form — usually the "switch to register" link. */
  footer?: ReactNode;
};

/** Centered form page that keeps inputs clear of the keyboard. */
export const AuthTemplate = ({ title, subtitle, children, footer }: Props) => (
  <KeyboardAvoidingView
    style={styles.screen}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  >
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <MayaMark size={56} style={styles.brand} />

      <View style={styles.heading}>
        <Title>{title}</Title>
        {subtitle ? <Paragraph>{subtitle}</Paragraph> : null}
      </View>

      {children}

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </ScrollView>
  </KeyboardAvoidingView>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  brand: {
    alignItems: 'flex-start',
  },
  heading: {
    gap: spacing.sm,
  },
  footer: {
    alignItems: 'center',
  },
});
