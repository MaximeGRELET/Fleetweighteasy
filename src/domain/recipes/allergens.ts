import type { Allergen } from './types';
import { ALLERGENS } from './types';

/**
 * Correspondance entre ce que l'utilisateur déclare et ce que les recettes
 * portent.
 *
 * Le profil stocke des libellés français ; les recettes portent une union
 * stricte. Sans traduction explicite, l'exclusion des allergènes — le seul
 * filtre que la spécification qualifie de non négociable — ne s'appliquerait
 * jamais, et **sans rien signaler**.
 *
 * Le vocabulaire est fermé à la saisie depuis la Phase 7 : les propositions de
 * l'onboarding sont exactement les libellés canoniques ci-dessous. Les alias
 * couvrent les formulations des versions antérieures et les variantes
 * courantes, pour qu'un profil existant continue d'être protégé.
 */

/** Libellé affiché pour chaque allergène. C'est aussi ce que l'onboarding propose. */
export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: 'Gluten',
  dairy: 'Lait',
  eggs: 'Œufs',
  nuts: 'Fruits à coque',
  peanuts: 'Arachides',
  soy: 'Soja',
  shellfish: 'Crustacés',
  fish: 'Poisson',
  sesame: 'Sésame',
};

/** Libellés proposés à l'onboarding, dans l'ordre d'affichage. */
export const ALLERGEN_CHOICES: readonly string[] = ALLERGENS.map(
  (allergen) => ALLERGEN_LABELS[allergen],
);

/**
 * Formes reconnues, une fois normalisées.
 *
 * Comprend les libellés canoniques, ceux utilisés avant la fermeture du
 * vocabulaire (« Lactose », « Œuf », « Arachide ») et les synonymes qu'une
 * personne écrit spontanément.
 */
const ALIASES: Record<string, Allergen> = {
  gluten: 'gluten',
  ble: 'gluten',
  lait: 'dairy',
  lactose: 'dairy',
  'produits laitiers': 'dairy',
  oeuf: 'eggs',
  oeufs: 'eggs',
  'fruits a coque': 'nuts',
  noix: 'nuts',
  amande: 'nuts',
  amandes: 'nuts',
  noisette: 'nuts',
  noisettes: 'nuts',
  arachide: 'peanuts',
  arachides: 'peanuts',
  cacahuete: 'peanuts',
  cacahuetes: 'peanuts',
  soja: 'soy',
  crustace: 'shellfish',
  crustaces: 'shellfish',
  'fruits de mer': 'shellfish',
  poisson: 'fish',
  poissons: 'fish',
  sesame: 'sesame',
};

/**
 * Normalise une saisie : minuscules, accents retirés, espaces resserrés.
 *
 * « Œufs », « oeufs » et « ŒUFS » désignent la même chose ; les distinguer
 * reviendrait à ne pas protéger quelqu'un pour une question de casse.
 */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0153/gi, 'oe')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ResolvedAllergies {
  /** Allergènes reconnus, effectivement exclus des recettes. */
  allergens: Allergen[];
  /**
   * Saisies qu'aucun allergène ne représente.
   *
   * Remontées telles quelles pour être affichées : promettre un filtrage qu'on
   * ne peut pas tenir serait pire que de reconnaître la limite.
   */
  unrecognised: string[];
}

/**
 * Traduit les allergies déclarées au profil en allergènes du catalogue.
 *
 * Ce qui n'est pas reconnu n'est pas ignoré en silence : la liste
 * `unrecognised` existe pour que l'écran le dise.
 */
export function resolveAllergies(allergies: readonly string[]): ResolvedAllergies {
  const allergens = new Set<Allergen>();
  const unrecognised: string[] = [];

  for (const allergy of allergies) {
    const match = ALIASES[normalize(allergy)];

    if (match) {
      allergens.add(match);
    } else if (allergy.trim().length > 0) {
      unrecognised.push(allergy);
    }
  }

  return {
    allergens: ALLERGENS.filter((allergen) => allergens.has(allergen)),
    unrecognised,
  };
}

/**
 * Vrai si une saisie libre correspond au nom d'un ingrédient.
 *
 * Sert aux aliments détestés, qui ne relèvent pas de la sécurité : une
 * correspondance approximative y est acceptable là où elle ne le serait pas
 * pour un allergène.
 */
export function matchesIngredientName(dislike: string, ingredientName: string): boolean {
  const needle = normalize(dislike);

  return needle.length > 0 && normalize(ingredientName).includes(needle);
}
