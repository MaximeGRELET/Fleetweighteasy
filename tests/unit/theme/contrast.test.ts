import { darkColors, lightColors, type Palette } from '@/theme';

/**
 * Contrastes de la palette (WCAG 2.1).
 *
 * Une teinte retouchée « à l'œil » sur un seul écran peut passer sous le seuil
 * ailleurs sans que personne ne le remarque — sauf ceux qui voient mal. Ces
 * tests recensent les couples réellement employés par les composants.
 */

/** Luminance relative d'une couleur `#RRGGBB`. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

type Key = keyof Palette;

/** Texte : 4,5:1 (critère 1.4.3). Couples employés par `Text`, `Callout`, `Chip`… */
const TEXT_PAIRS: readonly [Key, Key][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'surfaceMuted'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['textMuted', 'surfaceMuted'],
  ['textMuted', 'primaryMuted'],
  ['textMuted', 'cautionSurface'],
  ['primary', 'background'],
  ['primary', 'surface'],
  ['primary', 'primaryMuted'],
  ['onPrimary', 'primary'],
  ['caution', 'background'],
  ['caution', 'surface'],
  ['caution', 'cautionSurface'],
];

/** Composant à repérer : 3:1 (critère 1.4.11). */
const CONTROL_PAIRS: readonly [Key, Key][] = [
  ['control', 'background'],
  ['control', 'surface'],
  ['control', 'surfaceMuted'],
];

describe.each([
  ['clair', lightColors],
  ['sombre', darkColors],
])('palette %s', (_name, palette) => {
  it.each(TEXT_PAIRS)('%s sur %s atteint 4,5:1', (foreground, background) => {
    expect(contrast(palette[foreground], palette[background])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(CONTROL_PAIRS)('%s sur %s atteint 3:1', (foreground, background) => {
    expect(contrast(palette[foreground], palette[background])).toBeGreaterThanOrEqual(3);
  });
});
