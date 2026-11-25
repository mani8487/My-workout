/**
 * Decides which theme is on and hands its colour roles to every screen.
 *
 * Choices (Settings): Auto (follows the iPhone's light/dark), Dark, Light, Frost, Ember,
 * Mist (Mist & Mint, which also follows the iPhone's light/dark).
 */
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { getSetting, setSetting } from '@/db/settings';
import { darkColors, emberColors, frostColors, lightColors, mistColors, mistDarkColors, type ColorRoles } from './colors';
import { applyThemeStyle, type ThemeName } from './typography';

export type ThemePreference = 'auto' | 'dark' | 'light' | 'frost' | 'ember' | 'mist';

type ThemeValue = {
  colors: ColorRoles;
  /** Which theme is actually showing. */
  name: ThemeName;
  /** True for the dark theme (used for the status bar and system pickers). */
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);
const COLORS: Record<ThemeName, ColorRoles> = {
  dark: darkColors,
  light: lightColors,
  frost: frostColors,
  ember: emberColors,
  mist: mistColors,
  'mist-dark': mistDarkColors,
};

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('auto');

  // Load the saved choice ("system" was the old name for Auto).
  useEffect(() => {
    getSetting(db, 'theme').then((v) => {
      if (v === 'system') setPreferenceState('auto');
      else if (v === 'light' || v === 'dark' || v === 'frost' || v === 'ember' || v === 'mist' || v === 'auto') setPreferenceState(v);
    });
  }, [db]);

  const setPreference = useCallback(
    (p: ThemePreference) => {
      setPreferenceState(p);
      setSetting(db, 'theme', p);
    },
    [db],
  );

  const systemDark = systemScheme === 'dark';
  const name: ThemeName =
    preference === 'auto' ? (systemDark ? 'dark' : 'light') : preference === 'mist' ? (systemDark ? 'mist-dark' : 'mist') : preference;

  const value = useMemo(() => {
    applyThemeStyle(name); // fonts and corner shapes for this theme
    return { colors: COLORS[name], name, isDark: name === 'dark' || name === 'ember' || name === 'mist-dark', preference, setPreference };
  }, [name, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Use inside any screen: `const { colors } = useTheme();` */
export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside AppThemeProvider');
  return value;
}
