import { Tabs } from 'expo-router';

import {
  DiscoverIcon,
  MyAppsIcon,
  ProfileIcon,
} from '../../src/components/atoms';
import { colors, typography } from '../../src/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
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
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          ...typography.label,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'MAYA',
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color }) => <DiscoverIcon color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="my-apps"
        options={{
          title: 'My Apps',
          tabBarIcon: ({ color }) => <MyAppsIcon color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <ProfileIcon color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
