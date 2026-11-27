/**
 * Decides whether Mist & Mint shows light or dark, and hands its colour roles to every screen.
 *
 * Choices (Settings → Appearance): Auto (follows the iPhone), Light, Dark.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { getSetting, setSetting } from '@/db/settings';
import { mistColors, mistDarkColors, type ColorRoles } from './colors';
import type { ThemeName } from './typography';

export type ThemePreference = 'auto' | 'light' | 'dark';

type ThemeValue = {
  colors: ColorRoles;
  /** Which theme is actually showing. */
  name: ThemeName;
  /** True for the dark version (used for the status bar and system pickers). */
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);
const COLORS: Record<ThemeName, ColorRoles> = { mist: mistColors, 'mist-dark': mistDarkColors };

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('auto');

  // Load the saved choice. Choices from the old looks (Frost, Ember, Mist, "system") all mean Auto now.
  useEffect(() => {
    getSetting(db, 'theme').then((v) => setPreferenceState(v === 'light' || v === 'dark' ? v : 'auto'));
  }, [db]);

  const setPreference = useCallback(
    (p: ThemePreference) => {
      setPreferenceState(p);
      setSetting(db, 'theme', p);
    },
    [db],
  );

  const dark = preference === 'auto' ? systemScheme === 'dark' : preference === 'dark';
  const name: ThemeName = dark ? 'mist-dark' : 'mist';

  const value = useMemo(() => ({ colors: COLORS[name], name, isDark: dark, preference, setPreference }), [name, dark, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Shows everything inside in Mist light or Mist dark, whatever the app shows
 * (the Scene Lab uses this to compare both).
 */
export function MistPreview({ dark, children }: { dark: boolean; children: ReactNode }) {
  const outer = useTheme();
  const value = useMemo<ThemeValue>(
    () => ({ ...outer, colors: dark ? mistDarkColors : mistColors, name: dark ? 'mist-dark' : 'mist', isDark: dark }),
    [outer, dark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Use inside any screen: `const { colors } = useTheme();` */
export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside AppThemeProvider');
  return value;
}
