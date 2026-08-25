import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../src/components/atoms';
import { Catalog, Install, Updates } from '../src/components/illustrations';
import {
  MayaIntro,
  OnboardingCarousel,
  type Slide,
} from '../src/components/organisms';
import { useT, type Translate } from '../src/i18n';
import { useTheme } from '../src/theme';
import { colors, spacing, themedStyles } from '../src/constants/theme';

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

/** Signed-out landing. The gate in app/_layout.tsx routes here. */
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  // Subscribes this screen to the palette so a theme change re-renders it,
  // and through it everything it renders. See ThemeProvider.
  useTheme();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl }]}>
      <MayaIntro size={84} />

      <View style={styles.carousel}>
        <OnboardingCarousel slides={slidesFor(t)} />
      </View>

      <View
        style={[styles.actions, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <Button label={t('auth.signIn.action')} onPress={() => router.push('/login')} />
        <Button
          label={t('auth.register.action')}
          variant="ghost"
          onPress={() => router.push('/register')}
        />
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  carousel: {
    flex: 1,
    justifyContent: 'center',
  },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
}));
