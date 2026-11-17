/**
 * Decides whether the app is in light or dark mode and hands the right
 * set of colour roles to every screen.
 *
 * "system" (the default) follows the iPhone's own setting.
 * Later, the Settings screen will let you force "light" or "dark".
 */
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { getSetting, setSetting } from '@/db/settings';
import { darkColors, lightColors, type ColorRoles } from './colors';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeValue = {
  colors: ColorRoles;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Load the saved choice from Settings.
  useEffect(() => {
    getSetting(db, 'theme').then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setPreferenceState(v);
    });
  }, [db]);

  const setPreference = useCallback(
    (p: ThemePreference) => {
      setPreferenceState(p);
      setSetting(db, 'theme', p);
    },
    [db],
  );

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  const value = useMemo(
    () => ({ colors: isDark ? darkColors : lightColors, isDark, preference, setPreference }),
    [isDark, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Use inside any screen: `const { colors } = useTheme();` */
export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside AppThemeProvider');
  return value;
}
