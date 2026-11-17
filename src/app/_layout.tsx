/**
 * The outermost layout of the app.
 * - Provides the colour roles (light/dark) to every screen.
 * - Holds a "stack" of screens: the tab bar lives at the bottom of the stack,
 *   and later the workout screens (Active Workout, Finish Summary, etc.) slide in on top of it.
 */
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
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
        <Stack.Screen name="workout/preview" />
        <Stack.Screen name="workout/change" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout/active" />
        <Stack.Screen name="workout/overview" />
        <Stack.Screen name="workout/swap" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout/summary" options={{ gestureEnabled: false }} />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="log-workout" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pick-exercise" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="plates" />
        <Stack.Screen name="library" />
        <Stack.Screen name="exercise-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plans" />
        <Stack.Screen name="routine/[routineId]" />
        <Stack.Screen name="workout-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plan/[workoutId]" />
        <Stack.Screen name="plan/add" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // The Inter font files are bundled inside the app, so this works offline.
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!fontsLoaded) return null;

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
