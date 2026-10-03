import { createContext, use, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type DuoTheme } from '@/constants/duo-theme';

/** 'system' follows the phone's light/dark setting. */
export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  theme: DuoTheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Switch between light and night (overrides the system setting). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function DuoThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');
  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext value={{ theme, mode, setMode, toggle: () => setMode(isDark ? 'light' : 'dark') }}>
      {children}
    </ThemeContext>
  );
}

export function useThemeMode(): ThemeState {
  const ctx = use(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used inside <DuoThemeProvider>');
  return ctx;
}

/** The current colour palette. */
export function useDuo(): DuoTheme {
  return useThemeMode().theme;
}

/**
 * Create a hook that returns StyleSheet styles for the current theme.
 * Styles are built once per theme and cached.
 *
 *   const useStyles = themedStyles((t) => ({ card: { backgroundColor: t.card } }));
 *   const styles = useStyles();
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(factory: (t: DuoTheme) => T) {
  const cache = new Map<DuoTheme, T>();
  return function useStyles(): T {
    const t = useDuo();
    let styles = cache.get(t);
    if (!styles) {
      styles = StyleSheet.create(factory(t));
      cache.set(t, styles);
    }
    return styles;
  };
}
