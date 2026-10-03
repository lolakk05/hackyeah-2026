import { StyleSheet } from 'react-native';

import { theme, type DuoTheme } from '@/constants/duo-theme';

/** The app's colour palette (there is a single dark theme). */
export function useDuo(): DuoTheme {
  return theme;
}

/**
 * Create a hook that returns StyleSheet styles built from the theme.
 *
 *   const useStyles = themedStyles((t) => ({ card: { backgroundColor: t.card } }));
 *   const styles = useStyles();
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(factory: (t: DuoTheme) => T) {
  let styles: T | null = null;
  return function useStyles(): T {
    if (!styles) styles = StyleSheet.create(factory(theme));
    return styles;
  };
}
