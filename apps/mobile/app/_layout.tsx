import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Stack, useNavigationContainerRef, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '../src/services/auth';
import { ThemeProvider, useTheme } from '../src/theme';
import { I18nProvider } from '../src/i18n';
import { UpdateGate, useUpdateGate } from '../src/services/update';
import { DialogHost } from '../src/services/dialog';
import { InstallProvider } from '../src/services/install/InstallProvider';
import {
  InstallConfirmSheet,
  SplashScreen,
  useSplashFloor,
} from '../src/components/organisms';
import {
  loadOnboardingSeen,
  onboardingSeen,
} from '../src/services/storage/onboarding';
import {
  initSentry,
  installCrashHandlers,
  track,
  navigationIntegration,
  Sentry,
  useScreenTracking,
} from '../src/services/telemetry';
import { useNotificationNavigation } from '../src/services/notifications/useNotificationNavigation';
import { colors, themedStyles, typography } from '../src/theme/tokens';

/**
 * A deep link straight into /app/[slug] arrives with no history, so the detail
 * screen renders without a back button. Anchoring the stack on the tab group
 * makes expo-router synthesize it as the parent entry.
 */
/** This app's own package name, as declared in app.json. */
const MAYA_PACKAGE_ID = 'com.maya.store';

export const unstable_settings = {
  anchor: '(tabs)',
};

/*
 * Before the first render, deliberately. An error thrown while the tree first
 * mounts is precisely the kind worth reporting, and installing from an effect
 * would arrive after that render had already failed.
 */
// Sentry first: it installs its global handler, and installCrashHandlers then
// wraps it, so an uncaught error reaches both reporters exactly once each.
initSentry();
installCrashHandlers();

/**
 * One event per cold start and per return to the foreground — the denominator
 * for every retention number. Without it "daily users" can only be inferred
 * from whichever screens happened to fire something.
 */
const AppOpenTracker = () => {
  useEffect(() => {
    track('app_open', { source: 'launch' });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') track('app_open', { source: 'foreground' });
    });
    return () => subscription.remove();
  }, []);
  return null;
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
  const params = gate.check && {
    from_version: gate.check.currentVersion,
    to_version: gate.check.latestVersion,
    required: gate.check.updateRequired,
  };

  // How many people see the prompt, and how many of them take it: the two
  // numbers that say whether a release is actually reaching phones.
  const latest = gate.visible ? gate.check?.latestVersion : undefined;
  useEffect(() => {
    if (latest && params) track('self_update_prompted', params);
    // Once per version shown, not per re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest]);

  return (
    <UpdateGate
      check={gate.check}
      visible={gate.visible}
      onDismiss={() => {
        if (params && !params.required) track('self_update_later', params);
        gate.dismiss();
      }}
      onUpdate={() => params && track('self_update_accepted', params)}
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
  const splashDone = useSplashFloor();
  /*
   * The Stack below sets header and content colours from the palette, and this
   * component is not otherwise a subscriber — ThemeProvider passes `children`
   * through by identity, so React skips the subtree and only context readers
   * re-render. Without this the navigator keeps the previous theme's chrome.
   */
  useTheme();
  const [introChecked, setIntroChecked] = useState(onboardingSeen() !== null);

  useScreenTracking();
  // Only once the catalog is on screen: a tap that cold-starts a signed-out
  // MAYA waits through sign-in and is routed afterwards.
  useNotificationNavigation(status === 'signedIn' && introChecked && splashDone);

  useEffect(() => {
    if (introChecked) return;
    void loadOnboardingSeen().then(() => setIntroChecked(true));
  }, [introChecked]);

  useEffect(() => {
    if (status === 'loading' || !introChecked) return;

    const root = segments[0];
    const inPublicArea = root ? PUBLIC_SEGMENTS.has(root) : false;

    if (status === 'signedOut' && !inPublicArea) {
      /*
       * Read live rather than from state: this effect re-runs on every
       * navigation, and someone who finished the intro and later signed out
       * must land on sign-in rather than being walked through the pitch again.
       */
      router.replace(onboardingSeen() ? '/login' : '/onboarding');
    } else if (status === 'signedIn' && inPublicArea) {
      router.replace('/');
    }
  }, [status, introChecked, segments, router]);

  // The floor is ANDed in here rather than awaited before the redirect effect,
  // so restore and the animation overlap instead of queueing.
  if (status === 'loading' || !introChecked || !splashDone) {
    return <SplashScreen />;
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

function RootLayout() {
  // Screen changes become Sentry transactions named after the route.
  const navigation = useNavigationContainerRef();
  useEffect(() => {
    if (navigation) navigationIntegration.registerNavigationContainer(navigation);
  }, [navigation]);

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
                <AppOpenTracker />
                <DialogHost />
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
}));

// Sentry.wrap adds an error boundary and the app-start / touch instrumentation.
export default Sentry.wrap(RootLayout);
