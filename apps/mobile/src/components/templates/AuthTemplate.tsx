import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, themedStyles } from '../../constants/theme';
import { FadeIn } from '../../motion';
import { MayaMark, Paragraph, Title } from '../atoms';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the form — usually the "switch to register" link. */
  footer?: ReactNode;
};

/**
 * Centered form page that keeps inputs clear of the keyboard.
 *
 * `behavior` is set on BOTH platforms. It used to be `undefined` on Android,
 * which makes KeyboardAvoidingView a no-op — and because the content is
 * centered and shorter than the screen, the ScrollView had no scroll range
 * either. The password field simply sat under the keyboard with no way to
 * reach it. Padding gives the scroll view the extra height it needs to scroll
 * the focused field into view.
 */
export const AuthTemplate = ({ title, subtitle, children, footer }: Props) => (
  <KeyboardAvoidingView style={styles.screen} behavior="padding">
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      // iOS insets the scroll view for the keyboard itself; Android relies on
      // the padding above. Harmless where unsupported.
      automaticallyAdjustKeyboardInsets
    >
      <FadeIn index={0}>
        <MayaMark size={56} style={styles.brand} />
      </FadeIn>

      <FadeIn index={1} style={styles.heading}>
        <Title>{title}</Title>
        {subtitle ? <Paragraph>{subtitle}</Paragraph> : null}
      </FadeIn>

      <FadeIn index={2}>{children}</FadeIn>

      {footer ? (
        <FadeIn index={3} style={styles.footer}>
          {footer}
        </FadeIn>
      ) : null}
    </ScrollView>
  </KeyboardAvoidingView>
);

const styles = themedStyles(() => ({
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
}));
