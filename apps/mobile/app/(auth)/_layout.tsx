import { Stack } from 'expo-router';

import { useTheme } from '../../src/theme';
import { colors, typography } from '../../src/constants/theme';

export const unstable_settings = {
  initialRouteName: 'login',
};

export default function AuthLayout() {
  // Same reason as the root layout: these screenOptions read the palette, and
  // a layout that never subscribes never learns the palette changed.
  useTheme();

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
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Create account' }} />
    </Stack>
  );
}
