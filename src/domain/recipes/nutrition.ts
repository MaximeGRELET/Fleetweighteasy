import { InvalidInputError } from '@/domain/errors';
import type { NutritionSnapshot } from '@/domain/journal/types';

import { deriveAllergens, deriveDietTypes, resolveIngredients } from './diet';
import type { Recipe, RecipeNutrition, ResolvedRecipe } from './types';

/**
 * Nutrition des recettes.
 *
 * Calculée depuis les ingrédients, **jamais** saisie à la main : une valeur
 * recopiée deviendrait fausse dès qu'une quantité change, sans que rien ne le
 * signale (PHASES_6_A_10 §7.4).
 *
 * Les quantités des recettes sont exprimées dans l'**état** de la table de
 * référence — cru pour le riz cru, cuit pour les pois chiches en conserve. Le
 * calcul ne convertit rien : il applique les valeurs de l'état déclaré aux
 * quantités déclarées dans le même état.
 */

const GRAMS_PER_REFERENCE_PORTION = 100;

/** Même politique d'arrondi que les snapshots du journal : le dixième. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function assertUsablePortions(portions: number): void {
  if (!Number.isFinite(portions) || portions <= 0) {
    throw new InvalidInputError(
      'portions',
      `Le nombre de portions doit être strictement positif : ${portions}.`,
    );
  }
}

/** Valeurs de la recette **entière**, avant division par les portions. */
export function recipeTotals(recipe: Recipe): RecipeNutrition {
  const resolved = resolveIngredients(recipe);

  const totals = resolved.reduce(
    (accumulator, { ingredient, ref }) => {
      const ratio = ingredient.quantityG / GRAMS_PER_REFERENCE_PORTION;

      return {
        kcal: accumulator.kcal + ref.per100g.kcal * ratio,
        proteinG: accumulator.proteinG + ref.per100g.proteinG * ratio,
        carbsG: accumulator.carbsG + ref.per100g.carbsG * ratio,
        fatG: accumulator.fatG + ref.per100g.fatG * ratio,
      };
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  return {
    kcal: Math.round(totals.kcal),
    proteinG: round1(totals.proteinG),
    carbsG: round1(totals.carbsG),
    fatG: round1(totals.fatG),
  };
}

/** Poids total de la recette, dans l'état de référence des ingrédients. */
export function recipeWeightG(recipe: Recipe): number {
  return round1(recipe.ingredients.reduce((total, ingredient) => total + ingredient.quantityG, 0));
}

/**
 * Recette enrichie de tout ce qui se déduit d'elle.
 *
 * Calculé à la demande plutôt que stocké : le catalogue reste une donnée pure,
 * et une correction de la table d'ingrédients se propage partout sans qu'aucun
 * cache n'ait à être invalidé.
 */
export function resolveRecipe(recipe: Recipe): ResolvedRecipe {
  assertUsablePortions(recipe.servings);

  if (recipe.ingredients.length === 0) {
    throw new InvalidInputError(
      'ingredients',
      `La recette « ${recipe.name} » ne contient aucun ingrédient.`,
    );
  }

  const refs = resolveIngredients(recipe).map(({ ref }) => ref);
  const totals = recipeTotals(recipe);

  return {
    ...recipe,
    allergens: deriveAllergens(refs),
    dietTypes: deriveDietTypes(refs),
    nutritionPerServing: {
      kcal: Math.round(totals.kcal / recipe.servings),
      proteinG: round1(totals.proteinG / recipe.servings),
      carbsG: round1(totals.carbsG / recipe.servings),
      fatG: round1(totals.fatG / recipe.servings),
    },
    servingWeightG: round1(recipeWeightG(recipe) / recipe.servings),
  };
}

/**
 * Fige les valeurs d'une recette pour un nombre de portions consommées.
 *
 * Produit le **même** `NutritionSnapshot` que le journal stocke déjà pour un
 * produit Open Food Facts ou un repas prédéfini : une entrée issue d'une
 * recette est donc immuable au même titre que les autres, et les totaux du jour
 * la somment sans savoir d'où elle vient (PHASE_2 §2.4).
 *
 * L'entrée créée ne référence pas la recette : le catalogue est livré avec
 * l'application et peut changer à la mise à jour suivante, tandis que le
 * snapshot, lui, dit ce qui a été mangé ce jour-là et le dira toujours.
 */
export function snapshotForRecipe(recipe: Recipe, portions = 1): NutritionSnapshot {
  assertUsablePortions(portions);

  const resolved = resolveRecipe(recipe);
  const scale = portions;

  return {
    name: resolved.name,
    kcal: Math.round(resolved.nutritionPerServing.kcal * scale),
    proteinG: round1(resolved.nutritionPerServing.proteinG * scale),
    carbsG: round1(resolved.nutritionPerServing.carbsG * scale),
    fatG: round1(resolved.nutritionPerServing.fatG * scale),
  };
}

/** Poids à enregistrer dans `quantityG` pour le nombre de portions consommées. */
export function portionWeightG(recipe: Recipe, portions = 1): number {
  assertUsablePortions(portions);

  return round1(resolveRecipe(recipe).servingWeightG * portions);
}
