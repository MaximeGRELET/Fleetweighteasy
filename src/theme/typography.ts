import { Platform, type TextStyle } from 'react-native';

const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'system-ui',
});

/**
 * Échelle typographique. `numeric` est réservé aux chiffres calculés
 * (calories, macros, poids) : tabular pour éviter le sautillement des compteurs.
 */
export const typography = {
  title: { fontFamily: systemFont, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontFamily: systemFont, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  subheading: { fontFamily: systemFont, fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontFamily: systemFont, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  caption: { fontFamily: systemFont, fontSize: 13, lineHeight: 18, fontWeight: '400' },
  numeric: {
    fontFamily: systemFont,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
