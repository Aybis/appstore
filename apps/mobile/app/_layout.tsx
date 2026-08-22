import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '../src/auth';
import { InstallProvider } from '../src/install/InstallProvider';
import { InstallConfirmSheet } from '../src/components/organisms';
import { MayaMark } from '../src/components/atoms';
import { FadeIn } from '../src/motion';
import { colors, typography } from '../src/constants/theme';

/**
 * A deep link straight into /app/[slug] arrives with no history, so the detail
 * screen renders without a back button. Anchoring the stack on the tab group
 * makes expo-router synthesize it as the parent entry.
 */
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

/** Route groups a signed-out user is allowed to sit on. */
const PUBLIC_SEGMENTS = new Set(['onboarding', '(auth)']);

/**
 * Sends signed-out users to onboarding and bounces signed-in users out of the
 * auth screens. Runs after the session has been restored so a cold start does
 * not flash the catalog before redirecting.
 */
const AuthGate = () => {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    const root = segments[0];
    const inPublicArea = root ? PUBLIC_SEGMENTS.has(root) : false;

    if (status === 'signedOut' && !inPublicArea) {
      router.replace('/onboarding');
    } else if (status === 'signedIn' && inPublicArea) {
      router.replace('/');
    }
  }, [status, segments, router]);

  if (status === 'loading') {
    return (
      <View style={styles.splash}>
        <FadeIn translateY={0}>
          <MayaMark size={64} />
        </FadeIn>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.accent,
        headerTitleStyle: {
          color: colors.text,
          fontSize: typography.sectionTitle.fontSize,
          fontWeight: typography.sectionTitle.fontWeight,
        },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      {/* The tab group renders its own headers. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="app/[slug]" options={{ title: 'App Detail' }} />
    </Stack>
  );
};

export default function RootLayout() {
  return (
    // gesture-handler requires a root view somewhere above any gesture — the
    // sheets' swipe-to-dismiss silently no-ops without this.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider>
          <InstallProvider>
            <AuthGate />
            <InstallConfirmSheet />
          </InstallProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
