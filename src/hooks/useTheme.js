import { useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { palettes } from '../theme';

/** { scheme: 'light' | 'dark', c: palette } for the phone's current appearance. */
export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, c: palettes[scheme] };
}

/**
 * Styles that depend on the palette. Define `makeStyles = (c) => ({ ... })` at
 * module level and call useStyles(makeStyles); it is rebuilt only when the
 * appearance changes.
 */
export function useStyles(makeStyles) {
  const { c } = useTheme();
  return useMemo(() => StyleSheet.create(makeStyles(c)), [makeStyles, c]);
}
