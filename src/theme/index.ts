import { darkColors, lightColors, type Palette } from './colors';
import { maxContentWidth, minTouchTarget, radius, spacing } from './spacing';
import { typography } from './typography';

export type ColorScheme = 'light' | 'dark';

export type Theme = {
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  maxContentWidth: number;
  minTouchTarget: number;
};

const base = { spacing, radius, typography, maxContentWidth, minTouchTarget } as const;

export const lightTheme: Theme = { scheme: 'light', colors: lightColors, ...base };
export const darkTheme: Theme = { scheme: 'dark', colors: darkColors, ...base };

/** Le clair est le défaut : toute valeur inconnue ou absente y retombe. */
export function getTheme(scheme: string | null | undefined): Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}

export { darkColors, lightColors, maxContentWidth, minTouchTarget, radius, spacing, typography };
export type { Palette };
