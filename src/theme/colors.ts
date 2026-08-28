/**
 * Palette de l'application.
 *
 * Positionnement produit : sobre, sérieux, non gamifié (PLAN_IMPLEMENTATION §1.6).
 * Pas de rouge « alarme » pour un dépassement calorique : les états sensibles
 * utilisent des tons neutres ou ambrés, jamais culpabilisants.
 */
type Palette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textInverted: string;
  primary: string;
  primaryMuted: string;
  onPrimary: string;
  /** Réservé aux garde-fous de sécurité et messages de prudence. */
  caution: string;
  cautionSurface: string;
  positive: string;
  /** Macronutriments — utilisé par les graphiques et les jauges. */
  protein: string;
  carbs: string;
  fat: string;
};

export const lightColors: Palette = {
  background: '#FBFBFA',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F2F0',
  border: '#E2E2DE',
  text: '#1A1A18',
  textMuted: '#6B6B66',
  textInverted: '#FFFFFF',
  primary: '#2F6B57',
  primaryMuted: '#E4EFEA',
  onPrimary: '#FFFFFF',
  caution: '#8A5A12',
  cautionSurface: '#FBF1E0',
  positive: '#2F6B57',
  protein: '#3E6B8A',
  carbs: '#8A7A3E',
  fat: '#8A5A6B',
};

export const darkColors: Palette = {
  background: '#131311',
  surface: '#1C1C1A',
  surfaceMuted: '#252523',
  border: '#33332F',
  text: '#F2F2EF',
  textMuted: '#A0A099',
  textInverted: '#131311',
  primary: '#7FBBA3',
  primaryMuted: '#22332C',
  onPrimary: '#0E1A15',
  caution: '#D8A860',
  cautionSurface: '#332A1B',
  positive: '#7FBBA3',
  protein: '#8AB4D1',
  carbs: '#D1C08A',
  fat: '#D18AA5',
};

export type { Palette };
