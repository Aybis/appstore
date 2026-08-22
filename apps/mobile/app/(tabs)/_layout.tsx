import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { usePushRegistration } from '../../src/notifications/usePushRegistration';

import {
  DiscoverIcon,
  MyAppsIcon,
  ProfileIcon,
} from '../../src/components/atoms';
import { TAB_BAR_HEIGHT } from '../../src/constants/layout';
import { colors, radius, spacing, themedStyles, typography } from '../../src/constants/theme';
import { haptics, spring } from '../../src/motion';
import { useT } from '../../src/i18n';
import { useTheme } from '../../src/theme';



type TabGlyphProps = { focused: boolean; children: ReactNode };

/** Springs the active glyph up a touch so the active state reads as motion, not just a color swap. */
const TabGlyph = ({ focused, children }: TabGlyphProps) => {
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.value = withSpring(focused ? 1 : 0, spring.standard);
  }, [focused, active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + active.value * 0.14 },
      { translateY: active.value * -2 },
    ],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

export default function TabsLayout() {
  // Reaching the tabs means the user is signed in — the right moment to ask
  // for a push token, rather than during onboarding.
  usePushRegistration(true);
  const insets = useSafeAreaInsets();
  const t = useT();
  // Subscribes this screen to the palette so a theme change re-renders it,
  // and through it everything it renders. See ThemeProvider.
  useTheme();

  return (
    <Tabs
      screenListeners={{ tabPress: () => haptics.select() }}
      screenOptions={{
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          color: colors.text,
          fontSize: typography.sectionTitle.fontSize,
          fontWeight: typography.sectionTitle.fontWeight,
        },
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          ...typography.label,
          fontSize: 11,
        },
        tabBarItemStyle: {
          paddingTop: spacing.xs,
        },
        // Floats over scrolling content — screens add TAB_BAR_HEIGHT to their
        // own bottom inset (src/constants/layout.ts) so the last row can still
        // be scrolled clear of it.
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom,
          // Transparent here so `tabBarBackground` is what paints the bar;
          // that background is opaque, not glass — see the note on it below.
          backgroundColor: 'transparent',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          overflow: 'hidden',
          elevation: 0,
        },
        // Deliberately OPAQUE rather than a blur. A translucent bar over a
        // dense catalog list let card content read straight through the tab
        // labels, which looks broken rather than glassy — the rows underneath
        // are high-contrast artwork, not the flat wash blur flatters.
        tabBarBackground: () => <View style={styles.tabBarBackground} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'MAYA',
          tabBarLabel: t('tab.discover'),
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph focused={focused}>
              <DiscoverIcon color={color} size={22} />
            </TabGlyph>
          ),
        }}
      />
      <Tabs.Screen
        name="my-apps"
        options={{
          title: t('tab.myApps'),
          tabBarLabel: t('tab.myApps'),
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph focused={focused}>
              <MyAppsIcon color={color} size={22} />
            </TabGlyph>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tab.profile'),
          tabBarLabel: t('tab.profile'),
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph focused={focused}>
              <ProfileIcon color={color} size={22} />
            </TabGlyph>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = themedStyles(() => ({
  tabBarBackground: {
    // Written out rather than spreading StyleSheet.absoluteFillObject, which
    // React Native 0.86 no longer types.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.backgroundElevated,
  },
}));
