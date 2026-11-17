/**
 * The outermost layout of the app.
 * - Provides the colour roles (light/dark) to every screen.
 * - Holds a "stack" of screens: the tab bar lives at the bottom of the stack,
 *   and later the workout screens (Active Workout, Finish Summary…) slide in on top of it.
 */
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DATABASE_NAME, initDatabase } from '@/db/init';
import { RestTimerProvider } from '@/logic/rest-timer';
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
        <Stack.Screen name="workout/active" />
        <Stack.Screen name="workout/overview" />
        <Stack.Screen name="workout/swap" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout/summary" options={{ gestureEnabled: false }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    // Opens the on-phone database and runs initDatabase before any screen shows.
    // GestureHandlerRootView makes swipe gestures (like swipe-to-delete) work.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase}>
        <AppThemeProvider>
          <RestTimerProvider>
            <Navigation />
          </RestTimerProvider>
        </AppThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
