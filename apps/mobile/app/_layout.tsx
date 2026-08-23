import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '../src/auth';
import { ThemeProvider, useTheme } from '../src/theme';
import { I18nProvider } from '../src/i18n';
import { UpdateGate, useUpdateGate } from '../src/update';
import { InstallProvider } from '../src/install/InstallProvider';
import { InstallConfirmSheet } from '../src/components/organisms';
import { MayaMark } from '../src/components/atoms';
import { FadeIn } from '../src/motion';
import { colors, themedStyles, typography } from '../src/constants/theme';

/**
 * A deep link straight into /app/[slug] arrives with no history, so the detail
 * screen renders without a back button. Anchoring the stack on the tab group
 * makes expo-router synthesize it as the parent entry.
 */
/** This app's own package name, as declared in app.json. */
const MAYA_PACKAGE_ID = 'com.internal.appstore';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

/**
 * MAYA gating itself on its own catalog entry.
 *
 * The store is a distributed app like any other, so it checks the same public
 * endpoint its tenants' apps do. Two consequences worth stating: the rule gets
 * dogfooded rather than only asserted in tests, and this component doubles as
 * the reference implementation an app team copies — it uses nothing from MAYA
 * except the theme.
 *
 * If MAYA is not in the catalog, or the store is unreachable, `fetchVersionCheck`
 * returns null and nothing renders. A forced update must never fire because the
 * network was down.
 */
const SelfUpdateGate = () => {
  const gate = useUpdateGate({ packageId: MAYA_PACKAGE_ID });
  return (
    <UpdateGate
      check={gate.check}
      visible={gate.visible}
      onDismiss={gate.dismiss}
      appName="MAYA"
    />
  );
};

/** Status bar content follows the scheme — a fixed "light" leaves light mode
 * with white icons on a white bar. */
const ThemedStatusBar = () => {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
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
      {/*
        Theme and language sit ABOVE the providers that render UI: both remount
        their subtree on change, and anything below them re-reads colours and
        strings on the way back up.
      */}
      <ThemeProvider>
        <I18nProvider>
          <SafeAreaProvider>
            <ThemedStatusBar />
            <AuthProvider>
              <InstallProvider>
                <AuthGate />
                <InstallConfirmSheet />
                <SelfUpdateGate />
              </InstallProvider>
            </AuthProvider>
          </SafeAreaProvider>
        </I18nProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = themedStyles(() => ({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
}));
