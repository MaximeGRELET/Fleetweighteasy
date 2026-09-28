/**
 * Échelle d'espacement (base 4 px).
 * Une seule source de vérité : aucun nombre magique de padding/margin dans l'UI.
 */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/** Largeur de contenu maximale (lisibilité sur tablette / web). */
export const maxContentWidth = 560;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;

/**
 * Côté minimal d'une zone tactile : 48 dp, la recommandation Android (Apple
 * demande 44 pt). En dessous, un doigt mal assuré ou un tremblement fait rater
 * la cible — ou toucher sa voisine.
 */
export const minTouchTarget = 48;
