import { useCallback, useMemo } from 'react';

import { RECIPES } from '@/domain/recipes/content/recipes';
import { filterRecipes, type RecipeFilterResult } from '@/domain/recipes/filter';
import { portionWeightG, resolveRecipe, snapshotForRecipe } from '@/domain/recipes/nutrition';
import type { Recipe, ResolvedRecipe } from '@/domain/recipes/types';
import type { FoodLogEntry, MealType } from '@/domain/journal/types';
import { useSessionStore } from '@/stores/session';

import { useStoredProfile } from './use-profile';
import { useRepositories } from './use-repositories';

/**
 * Catalogue de recettes filtré pour l'utilisateur.
 *
 * Le catalogue est livré avec l'application : aucune lecture en base, aucun
 * appel réseau, donc disponible hors ligne comme le reste du journal. Le hook
 * ne décide rien — ni ce qui est exclu, ni dans quel ordre : il transmet le
 * profil au domaine et rend le résultat.
 */
export interface UseRecipesOptions {
  mealType?: MealType;
  maxPrepTimeMin?: number;
}

export function useRecipes(options: UseRecipesOptions = {}): RecipeFilterResult | undefined {
  const profile = useStoredProfile();
  const { mealType, maxPrepTimeMin } = options;

  return useMemo(
    () => (profile ? filterRecipes({ profile, mealType, maxPrepTimeMin }) : undefined),
    [profile, mealType, maxPrepTimeMin],
  );
}

/** Une recette du catalogue, résolue. `undefined` si l'identifiant est inconnu. */
export function useRecipe(recipeId: string | undefined): ResolvedRecipe | undefined {
  return useMemo(() => {
    const recipe = RECIPES.find(({ id }) => id === recipeId);

    return recipe ? resolveRecipe(recipe) : undefined;
  }, [recipeId]);
}

export interface LogRecipeInput {
  recipe: Recipe;
  mealType: MealType;
  /** Nombre de portions consommées. */
  portions: number;
  date: string;
}

/**
 * Ajout d'une recette au journal.
 *
 * L'entrée créée est une entrée de journal **ordinaire** : mêmes colonnes, même
 * snapshot figé, mêmes totaux du jour. Elle ne référence pas la recette, et
 * c'est délibéré — le catalogue est livré avec l'application et peut changer à
 * la mise à jour suivante, tandis que le snapshot dit ce qui a été mangé ce
 * jour-là et continuera de le dire (PHASE_2 §2.4).
 */
export function useLogRecipe(): (input: LogRecipeInput) => FoodLogEntry {
  const repositories = useRepositories();
  const bump = useSessionStore((state) => state.bumpJournalRevision);

  return useCallback(
    ({ recipe, mealType, portions, date }: LogRecipeInput) => {
      const entry = repositories.foodLog.addEntry({
        date,
        mealType,
        quantityG: portionWeightG(recipe, portions),
        snapshot: snapshotForRecipe(recipe, portions),
      });

      bump();
      return entry;
    },
    [repositories, bump],
  );
}
