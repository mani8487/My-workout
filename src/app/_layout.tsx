/**
 * The outermost layout of the app.
 * - Provides the colour roles (light/dark) to every screen.
 * - Holds a "stack" of screens: the tab bar lives at the bottom of the stack,
 *   and later the workout screens (Active Workout, Finish Summary…) slide in on top of it.
 */
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppThemeProvider, useTheme } from '@/theme/theme-context';

function Navigation() {
  const { colors, isDark } = useTheme();
  const base = isDark ? DarkTheme : DefaultTheme;

  // Tell the navigation library to use our colour roles too.
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <Navigation />
    </AppThemeProvider>
  );
}
