import type { MealType } from '@/domain/journal/types';
import type { UserProfile } from '@/domain/profile/types';

import { matchesIngredientName, resolveAllergies } from './allergens';
import { RECIPES } from './content/recipes';
import { resolveIngredients } from './diet';
import { resolveRecipe } from './nutrition';
import type { Recipe, ResolvedRecipe } from './types';

/**
 * Filtrage et ordonnancement des recettes.
 *
 * Deux natures d'exclusion cohabitent ici, et elles ne se valent pas.
 *
 * **Les allergènes sont une règle dure.** Une recette contenant un allergène
 * déclaré n'est jamais proposée, quelles que soient les autres considérations.
 * C'est le seul filtre que la spécification qualifie de non négociable
 * (BRIEF_RECETTES §3.1).
 *
 * **Le reste est une préférence.** Régime, aliments détestés, temps disponible
 * excluent aussi, mais leur enjeu est le confort, pas la sécurité. Le
 * classement qui suit ne fait que remonter ce qui tombe le mieux.
 */

/** Poids du classement. Nommés pour que l'ordre obtenu soit lisible et discutable. */
const SCORE_MEAL_TYPE_MATCH = 100;
const SCORE_GOAL_ALIGNED_TAG = 20;
const SCORE_QUICK = 5;

export interface RecipeFilterInput {
  /** Catalogue à filtrer. Le catalogue livré par défaut si absent. */
  recipes?: readonly Recipe[];
  profile: UserProfile;
  /** Moment de la journée à privilégier, sans exclure les autres. */
  mealType?: MealType;
  /** Temps disponible, en minutes. Exclut les recettes plus longues. */
  maxPrepTimeMin?: number;
}

export interface RecipeFilterResult {
  recipes: ResolvedRecipe[];
  /**
   * Allergies déclarées qu'aucun allergène du catalogue ne représente.
   *
   * L'écran doit le dire : ces saisies ne filtrent rien, et laisser croire le
   * contraire serait plus dangereux que de reconnaître la limite.
   */
  unrecognisedAllergies: string[];
}

export function filterRecipes(input: RecipeFilterInput): RecipeFilterResult {
  const catalogue = input.recipes ?? RECIPES;
  const { allergens, unrecognised } = resolveAllergies(input.profile.allergies);

  const kept = catalogue
    .map(resolveRecipe)
    .filter((recipe) => !recipe.allergens.some((allergen) => allergens.includes(allergen)))
    .filter((recipe) => recipe.dietTypes.includes(input.profile.dietType))
    .filter((recipe) => !containsDislikedIngredient(recipe, input.profile.dislikes))
    .filter(
      (recipe) => input.maxPrepTimeMin === undefined || recipe.prepTimeMin <= input.maxPrepTimeMin,
    );

  return {
    recipes: kept.sort((a, b) => compareRecipes(a, b, input)),
    unrecognisedAllergies: unrecognised,
  };
}

/**
 * Vrai si un ingrédient porte le nom d'un aliment détesté.
 *
 * La correspondance est approximative — « oignon » retrouve « Oignon » — parce
 * qu'un aliment détesté relève du goût. Un ingrédient absent de la table de
 * référence, ou nommé autrement que ce que l'utilisateur a écrit, ne sera pas
 * repéré : c'est une limite assumée, sans conséquence de sécurité.
 */
function containsDislikedIngredient(recipe: Recipe, dislikes: readonly string[]): boolean {
  if (dislikes.length === 0) {
    return false;
  }

  return resolveIngredients(recipe).some(({ ref }) =>
    dislikes.some((dislike) => matchesIngredientName(dislike, ref.name)),
  );
}

/**
 * Pertinence d'une recette pour un profil.
 *
 * Le moment de la journée pèse le plus lourd : à midi, une recette de dîner
 * n'est pas fausse, seulement moins à propos. Viennent ensuite les atouts
 * alignés avec l'objectif, puis la rapidité, qui départage à mérite égal.
 */
export function scoreRecipe(recipe: ResolvedRecipe, input: RecipeFilterInput): number {
  let score = 0;

  if (input.mealType && recipe.mealTypes.includes(input.mealType)) {
    score += SCORE_MEAL_TYPE_MATCH;
  }

  for (const tag of goalAlignedTags(input.profile)) {
    if (recipe.tags.includes(tag)) {
      score += SCORE_GOAL_ALIGNED_TAG;
    }
  }

  if (recipe.tags.includes('quick') || recipe.tags.includes('no_cook')) {
    score += SCORE_QUICK;
  }

  return score;
}

/**
 * Atouts nutritionnels à mettre en avant selon l'objectif.
 *
 * En perte comme en recomposition, les protéines protègent la masse maigre —
 * c'est le message que portent déjà les briques de conseil de la Phase 6, et
 * les recettes remontées doivent dire la même chose. Le maintien ne privilégie
 * rien : il n'y a pas de raison d'orienter l'assiette de quelqu'un qui ne
 * cherche pas à changer de poids.
 */
function goalAlignedTags(profile: UserProfile): readonly ('high_protein' | 'low_calorie')[] {
  switch (profile.goalType) {
    case 'weight_loss':
      return ['high_protein', 'low_calorie'];
    case 'recomposition':
      return ['high_protein'];
    case 'maintenance':
      return [];
  }
}

/**
 * Score décroissant, puis identifiant.
 *
 * Le départage par identifiant n'est pas cosmétique : beaucoup de recettes
 * partagent le même score, et sans lui l'ordre dépendrait de la position dans
 * le catalogue — insérer une recette réordonnerait la liste de quelqu'un sans
 * raison visible.
 */
function compareRecipes(a: ResolvedRecipe, b: ResolvedRecipe, input: RecipeFilterInput): number {
  const difference = scoreRecipe(b, input) - scoreRecipe(a, input);

  if (difference !== 0) {
    return difference;
  }

  return a.id < b.id ? -1 : 1;
}
