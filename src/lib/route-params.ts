import { MEAL_TYPES, type MealType } from '@/domain/journal/types';

/**
 * Lecture des paramètres de route.
 *
 * Un paramètre d'URL est une chaîne venue de l'extérieur — un lien profond, un
 * historique de navigation, une route reconstruite après reprise de l'app. Le
 * transtyper en type du domaine reviendrait à affirmer sans vérifier ; ces
 * fonctions valident et rendent `undefined` plutôt que de propager une valeur
 * dont personne n'a contrôlé la forme.
 */

export function readMealTypeParam(value: string | string[] | undefined): MealType | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return MEAL_TYPES.find((mealType) => mealType === first);
}

/** Premier élément d'un paramètre, qu'il soit répété ou non. */
export function readStringParam(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first === undefined || first.trim() === '' ? undefined : first;
}
