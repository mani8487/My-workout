/**
 * The outermost layout of the app.
 * - Provides the colour roles (light/dark) to every screen.
 * - Holds a "stack" of screens: the tab bar lives at the bottom of the stack,
 *   and later the workout screens (Active Workout, Finish Summary, etc.) slide in on top of it.
 */
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import {
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  Geist_300Light,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { DMSans_300Light, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DATABASE_NAME, initDatabase } from '@/db/init';
import { RestTimerProvider } from '@/logic/rest-timer';
import { MotionRoot } from '@/motion';
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
        {/* Week Schedule slides up from the bottom. */}
        <Stack.Screen name="week" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout/change" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout/active" />
        <Stack.Screen name="workout/overview" />
        <Stack.Screen name="workout/swap" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout/summary" options={{ gestureEnabled: false }} />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="log-workout" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="quick-log"
          options={{ presentation: 'formSheet', sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true, sheetCornerRadius: 28 }}
        />
        <Stack.Screen
          name="water"
          options={{ presentation: 'formSheet', sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true, sheetCornerRadius: 28 }}
        />
        <Stack.Screen name="pick-exercise" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="plates" />
        <Stack.Screen name="scene-lab" />
        <Stack.Screen name="library" />
        <Stack.Screen name="exercise-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plans" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="routine/[routineId]" />
        <Stack.Screen name="workout-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plan/[workoutId]" />
        <Stack.Screen name="plan/add" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

/** If any screen crashes, show a friendly "Try again" page instead of closing the app. */
export { CrashScreen as ErrorBoundary } from '@/components/crash-screen';

export default function RootLayout() {
  // The Inter font files are bundled inside the app, so this works offline.
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Manrope_300Light, // Frost theme font
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Geist_300Light, // Ember theme fonts
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_500Medium,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });
  if (!fontsLoaded) return null;

  return (
    // Opens the on-phone database and runs initDatabase before any screen shows.
    // GestureHandlerRootView makes swipe gestures (like swipe-to-delete) work.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase}>
        <AppThemeProvider>
          <MotionRoot>
            <RestTimerProvider>
              <Navigation />
            </RestTimerProvider>
          </MotionRoot>
        </AppThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
