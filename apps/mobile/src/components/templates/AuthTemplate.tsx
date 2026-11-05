import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View, useWindowDimensions } from 'react-native';
import { colors, spacing, themedStyles } from '../../theme/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconArt } from '../molecules/IconArt';
import { FadeIn } from '../../motion';
import { MayaMark, Paragraph, Title } from '../atoms';
import { PreferenceToggles } from '../molecules';
import { useTheme } from '../../theme';

/**
 * The artwork wears the logo's own colours — cream and ink — instead of the
 * coral the other screens use, so the mark and what surrounds it read as one
 * thing. Light mode: warm sand rings with ink sparks. Dark mode: the same cream
 * at low strength on the dark ground, with cream sparks.
 */
const ART_TINT = {
  light: { ring: '#F8E9D8', core: '#F0DAC0', accent: '#1A1815' },
  dark: { ring: 'rgba(255,246,236,0.07)', core: 'rgba(255,246,236,0.12)', accent: '#FFF6EC' },
} as const;

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the form — usually the "switch to register" link. */
  footer?: ReactNode;
};

/**
 * Artwork height as a share of the screen.
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
}: Props) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const artHeight = Math.min(ART_MAX, Math.max(ART_MIN, height * ART_RATIO));

  return (
  <KeyboardAvoidingView style={styles.screen} behavior="padding">
    <ScrollView
      contentContainerStyle={[
        styles.content,
        // From the top, under the status bar. Centering the whole column left a
        // band of empty screen above the first control.
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      // iOS insets the scroll view for the keyboard itself; Android relies on
      // the padding above. Harmless where unsupported.
      automaticallyAdjustKeyboardInsets
    >
      {/* On the page before sign-in, pinned just under the status bar. */}
      <PreferenceToggles />

      <FadeIn index={0}>
        {/* The brand mark, alive: the same animated rings as the onboarding slides. */}
        <View style={styles.art}>
          <IconArt tint={ART_TINT[scheme]} width={width - spacing.xl * 2} height={artHeight}>
            <MayaMark size={artHeight * 0.4} />
          </IconArt>
        </View>
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
    paddingHorizontal: spacing.xl,
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
