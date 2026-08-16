import { Link, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { colors, typography } from '../src/constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
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
        <Stack.Screen
          name="index"
          options={{
            title: 'App Store',
            headerRight: () => (
              <Link href="/about" asChild>
                <Pressable hitSlop={12} accessibilityRole="button">
                  <Text style={styles.headerAction}>About</Text>
                </Pressable>
              </Link>
            ),
          }}
        />
        <Stack.Screen name="app/[slug]" options={{ title: 'App Detail' }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.accent,
  },
});
