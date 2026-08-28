import { useColorScheme } from 'react-native';

import { getTheme, type Theme } from '@/theme';

/** Seul point d'accès aux tokens de design depuis l'UI. */
export function useTheme(): Theme {
  return getTheme(useColorScheme());
}
