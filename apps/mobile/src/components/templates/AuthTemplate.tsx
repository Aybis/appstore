import type { ComponentType, ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View, useWindowDimensions } from 'react-native';
import { colors, spacing, themedStyles } from '../../constants/theme';
import type { IllustrationProps } from '../illustrations';
import { FadeIn } from '../../motion';
import { MayaMark, Paragraph, Title } from '../atoms';
import { PreferenceToggles } from '../molecules';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the form — usually the "switch to register" link. */
  footer?: ReactNode;
  /**
   * Artwork above the heading. Replaces the brand mark rather than joining it:
   * by the time anyone reaches this screen the splash has already shown them
   * the logo twice, and a third copy stacked over an illustration is clutter,
   * not branding.
   */
  illustration?: ComponentType<IllustrationProps>;
};

/**
 * Illustration height as a share of the screen.
 *
 * Proportional rather than fixed because this screen has a keyboard in its
 * future. On a short device a fixed height that looks generous empty pushes
 * the password field under the keyboard the moment it opens; the scroll view
 * can recover from that, but only by making someone scroll to type.
 */
const ART_RATIO = 0.2;
const ART_MIN = 120;
const ART_MAX = 190;

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
export const AuthTemplate = ({
  title,
  subtitle,
  children,
  footer,
  illustration: Illustration,
}: Props) => {
  const { width, height } = useWindowDimensions();
  const artHeight = Math.min(ART_MAX, Math.max(ART_MIN, height * ART_RATIO));

  return (
  <KeyboardAvoidingView style={styles.screen} behavior="padding">
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      // iOS insets the scroll view for the keyboard itself; Android relies on
      // the padding above. Harmless where unsupported.
      automaticallyAdjustKeyboardInsets
    >
      {/*
        Above everything, including the artwork. Someone who cannot read this
        screen needs the control that fixes that before they need the picture.
      */}
      <PreferenceToggles />

      <FadeIn index={0}>
        {Illustration ? (
          <View style={styles.art}>
            <Illustration width={width - spacing.xl * 2} height={artHeight} />
          </View>
        ) : (
          <MayaMark size={56} style={styles.brand} />
        )}
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
};

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
  art: {
    alignItems: 'center',
  },
  heading: {
    gap: spacing.sm,
  },
  footer: {
    alignItems: 'center',
  },
}));
