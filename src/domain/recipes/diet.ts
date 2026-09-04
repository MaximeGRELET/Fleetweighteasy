import { InvalidInputError } from '@/domain/errors';
import type { DietType } from '@/domain/profile/types';

import { INGREDIENTS_BY_ID } from './content/ingredients';
import type { Allergen, IngredientOrigin, IngredientRef, Recipe, RecipeIngredient } from './types';
import { ALLERGENS } from './types';

/**
 * Dérivation des allergènes et de la compatibilité régime.
 *
 * Rien n'est saisi à la main : tout se déduit des ingrédients. C'est la seule
 * façon qu'ajouter une recette ne puisse pas introduire un oubli, et l'exclusion
 * des allergènes est le filtre dont la spécification dit qu'il n'est pas
 * négociable (BRIEF_RECETTES §3).
 */

/** Tous les régimes, dans l'ordre du plus permissif au plus restrictif. */
const DIET_TYPES: readonly DietType[] = [
  'omnivore',
  'flexitarian',
  'pescatarian',
  'vegetarian',
  'vegan',
];

/**
 * Régimes incompatibles avec chaque origine alimentaire.
 *
 * Le flexitarien n'exclut rien : il réduit la viande sans la proscrire. Le
 * pescatarien accepte le poisson mais **pas** la viande — c'est précisément la
 * ligne que la table manuscrite du catalogue avait oubliée.
 */
const EXCLUSIONS_BY_ORIGIN: Record<IngredientOrigin, readonly DietType[]> = {
  plant: [],
  honey: ['vegan'],
  dairy: ['vegan'],
  egg: ['vegan'],
  fish: ['vegan', 'vegetarian'],
  meat: ['vegan', 'vegetarian', 'pescatarian'],
};

/**
 * Ingrédients d'une recette, résolus dans la table de référence.
 *
 * Lève si un identifiant est inconnu, plutôt que d'ignorer la ligne : une
 * recette dont un ingrédient manque afficherait une nutrition fausse et des
 * allergènes incomplets. Même choix que `snapshotForMeal` pour les repas
 * prédéfinis — refuser plutôt que servir une valeur amputée en silence.
 */
export function resolveIngredients(
  recipe: Recipe,
): { ingredient: RecipeIngredient; ref: IngredientRef }[] {
  return recipe.ingredients.map((ingredient) => {
    const ref = INGREDIENTS_BY_ID.get(ingredient.refId);

    if (!ref) {
      throw new InvalidInputError(
        'refId',
        `Ingrédient inconnu dans la recette « ${recipe.name} » : ${ingredient.refId}.`,
      );
    }

    return { ingredient, ref };
  });
}

/**
 * Allergènes présents dans une recette : l'union de ceux de ses ingrédients.
 *
 * Renvoyés dans l'ordre canonique, pour que deux recettes aux mêmes allergènes
 * les affichent dans le même ordre.
 */
export function deriveAllergens(refs: readonly IngredientRef[]): Allergen[] {
  const present = new Set(refs.flatMap((ref) => ref.allergens));

  return ALLERGENS.filter((allergen) => present.has(allergen));
}

/**
 * Régimes compatibles : tous ceux qu'aucun ingrédient n'exclut.
 *
 * Une recette sans ingrédient d'origine animale est compatible avec les cinq
 * régimes, végétalien compris — la liste est inclusive, comme le veut le brief.
 */
export function deriveDietTypes(refs: readonly IngredientRef[]): DietType[] {
  const excluded = new Set(refs.flatMap((ref) => EXCLUSIONS_BY_ORIGIN[ref.origin]));

  return DIET_TYPES.filter((diet) => !excluded.has(diet));
}

export { DIET_TYPES, EXCLUSIONS_BY_ORIGIN };
