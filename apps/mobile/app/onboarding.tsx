import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Catalog, Install, Updates } from '../src/components/illustrations';
import { OnboardingCarousel, type Slide } from '../src/components/organisms';
import { useT, type Translate } from '../src/i18n';
import { useTheme } from '../src/theme';
import { markOnboardingSeen } from '../src/storage/onboarding';
import { track } from '../src/telemetry';
import { colors, spacing, themedStyles, typography } from '../src/constants/theme';

const slidesFor = (t: Translate): readonly Slide[] => [
  {
    key: 'catalog',
    title: t('onboarding.catalog.title'),
    body: t('onboarding.catalog.body'),
    illustration: Catalog,
  },
  {
    key: 'install',
    title: t('onboarding.install.title'),
    body: t('onboarding.install.body'),
    illustration: Install,
  },
  {
    key: 'updates',
    title: t('onboarding.updates.title'),
    body: t('onboarding.updates.body'),
    illustration: Updates,
  },
];

/**
 * The intro, shown once per device.
 *
 * The brand animation that used to sit at the top of this screen is now the
 * splash that precedes it, and the sign-in buttons that used to sit at the
 * bottom are now the screen after it. What is left is the thing itself: three
 * pages, a way forward, and a way past.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const t = useT();
  // Subscribes this screen to the palette so a theme change re-renders it,
  // and through it everything it renders. See ThemeProvider.
  useTheme();

  const slides = slidesFor(t);
  const isLast = index === slides.length - 1;

  const leave = (how: 'skipped' | 'completed'): void => {
    track('onboarding_finished', { how, at_slide: index + 1 });
    // Recorded before navigating, so the gate's next read already knows.
    void markOnboardingSeen();
    router.replace('/login');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.top}>
        {/*
          Skip disappears on the last slide, where the primary button already
          says "Get started" and leads to the same place. Two controls one tap
          apart doing the same thing is a choice nobody wants to have to make.
        */}
        {!isLast && (
          <Pressable
            onPress={() => leave('skipped')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skip')}
          >
            {({ pressed }) => (
              <Text style={[styles.skip, pressed && styles.skipPressed]}>
                {t('onboarding.skip')}
              </Text>
            )}
          </Pressable>
        )}
      </View>

      <View style={styles.carousel}>
        <OnboardingCarousel
          slides={slides}
          onIndexChange={setIndex}
          onComplete={() => leave('completed')}
        />
      </View>

      <View style={{ height: insets.bottom + spacing.xl }} />
    </View>
  );
}

const styles = themedStyles(() => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  top: {
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  carousel: {
    // No centring here: the carousel now fills this box itself.
    flex: 1,
  },
  skip: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  skipPressed: {
    opacity: 0.55,
  },
}));
