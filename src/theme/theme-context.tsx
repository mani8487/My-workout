/**
 * Decides whether the app is in light or dark mode and hands the right
 * set of colour roles to every screen.
 *
 * "system" (the default) follows the iPhone's own setting.
 * Later, the Settings screen will let you force "light" or "dark".
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

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
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  const value = useMemo(
    () => ({ colors: isDark ? darkColors : lightColors, isDark, preference, setPreference }),
    [isDark, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Use inside any screen: `const { colors } = useTheme();` */
export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside AppThemeProvider');
  return value;
}
