import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../src/components/atoms';
import {
  MayaIntro,
  OnboardingCarousel,
  type Slide,
} from '../src/components/organisms';
import { colors, gradients, spacing } from '../src/constants/theme';

const SLIDES: readonly Slide[] = [
  {
    key: 'catalog',
    title: 'Your company’s apps',
    body: 'Every internal Android and iOS build your team is approved to use, in one private catalog.',
    palette: [gradients.brandDeep[0], gradients.brandDeep[2]],
  },
  {
    key: 'install',
    title: 'Install in a tap',
    body: 'Pick a build and hand it straight to your device. No public store, no sideloading guesswork.',
    palette: ['#0E7490', '#67E8F9'],
  },
  {
    key: 'updates',
    title: 'Stay current',
    body: 'My Apps tracks what you installed and flags a new version the moment it is published.',
    palette: ['#9D174D', '#F9A8D4'],
  },
];

/** Signed-out landing. The gate in app/_layout.tsx routes here. */
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl }]}>
      <MayaIntro size={84} />

      <View style={styles.carousel}>
        <OnboardingCarousel slides={SLIDES} />
      </View>

      <View
        style={[styles.actions, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <Button label="Sign in" onPress={() => router.push('/login')} />
        <Button
          label="Create account"
          variant="ghost"
          onPress={() => router.push('/register')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
