import { InvalidInputError } from '@/domain/errors';
import type { FoodItem, Meal } from '@/domain/food/types';

import type { DailyTotals, FoodLogEntry, NutritionSnapshot } from './types';

/**
 * Construction des snapshots nutritionnels et agrégation du jour.
 *
 * Fonctions pures. Le repository persiste ce que ces fonctions produisent : il
 * ne calcule jamais de nutrition lui-même.
 */

const GRAMS_PER_REFERENCE_PORTION = 100;

/** Arrondi au dixième : au-delà, on afficherait une fausse précision. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function assertUsableQuantity(quantityG: number): void {
  if (!Number.isFinite(quantityG) || quantityG <= 0) {
    throw new InvalidInputError(
      'quantityG',
      `La quantité doit être strictement positive : ${quantityG}.`,
    );
  }
}

/**
 * Fige les valeurs nutritionnelles d'un aliment pour une quantité donnée.
 *
 * Appelée **une seule fois**, au moment de l'ajout au journal. Le résultat est
 * stocké tel quel : une correction ultérieure de l'aliment source ne doit
 * jamais modifier une entrée existante.
 */
export function snapshotForFoodItem(item: FoodItem, quantityG: number): NutritionSnapshot {
  assertUsableQuantity(quantityG);

  const ratio = quantityG / GRAMS_PER_REFERENCE_PORTION;
  const per100 = item.nutritionPer100;

  return {
    name: item.brand ? `${item.name} (${item.brand})` : item.name,
    kcal: Math.round(per100.kcal * ratio),
    proteinG: round1(per100.proteinG * ratio),
    carbsG: round1(per100.carbsG * ratio),
    fatG: round1(per100.fatG * ratio),
    ...(per100.fiberG === undefined ? {} : { fiberG: round1(per100.fiberG * ratio) }),
  };
}

/**
 * Fige les valeurs d'un repas prédéfini, en sommant ses composants.
 *
 * @param resolveFoodItem accès aux aliments du repas ; lève si l'un manque —
 *   mieux vaut refuser l'ajout que journaliser un repas incomplet en silence.
 * @param servings nombre de portions du repas (1 par défaut)
 */
export function snapshotForMeal(
  meal: Meal,
  resolveFoodItem: (foodItemId: string) => FoodItem | undefined,
  servings = 1,
): NutritionSnapshot {
  assertUsableQuantity(servings);

  if (meal.items.length === 0) {
    throw new InvalidInputError('meal', `Le repas « ${meal.name} » ne contient aucun aliment.`);
  }

  const totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
  let hasFiber = false;

  for (const item of meal.items) {
    const foodItem = resolveFoodItem(item.foodItemId);

    if (!foodItem) {
      throw new InvalidInputError(
        'meal',
        `Aliment introuvable dans le repas « ${meal.name} » : ${item.foodItemId}.`,
      );
    }

    const ratio = (item.quantityG * servings) / GRAMS_PER_REFERENCE_PORTION;
    const per100 = foodItem.nutritionPer100;

    totals.kcal += per100.kcal * ratio;
    totals.proteinG += per100.proteinG * ratio;
    totals.carbsG += per100.carbsG * ratio;
    totals.fatG += per100.fatG * ratio;

    if (per100.fiberG !== undefined) {
      totals.fiberG += per100.fiberG * ratio;
      hasFiber = true;
    }
  }

  return {
    name: meal.name,
    kcal: Math.round(totals.kcal),
    proteinG: round1(totals.proteinG),
    carbsG: round1(totals.carbsG),
    fatG: round1(totals.fatG),
    ...(hasFiber ? { fiberG: round1(totals.fiberG) } : {}),
  };
}

/** Poids total (g) d'un repas prédéfini, pour renseigner `quantityG`. */
export function totalMealWeightG(meal: Meal, servings = 1): number {
  assertUsableQuantity(servings);
  return round1(meal.items.reduce((total, item) => total + item.quantityG, 0) * servings);
}

/**
 * Totaux du jour : somme des snapshots, jamais une jointure sur les aliments.
 * C'est ce qui garantit que le passé reste stable.
 */
export function sumDailyTotals(entries: readonly FoodLogEntry[]): DailyTotals {
  const totals = entries.reduce(
    (accumulator, entry) => ({
      kcal: accumulator.kcal + entry.snapshot.kcal,
      proteinG: accumulator.proteinG + entry.snapshot.proteinG,
      carbsG: accumulator.carbsG + entry.snapshot.carbsG,
      fatG: accumulator.fatG + entry.snapshot.fatG,
      fiberG: accumulator.fiberG + (entry.snapshot.fiberG ?? 0),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );

  return {
    kcal: Math.round(totals.kcal),
    proteinG: round1(totals.proteinG),
    carbsG: round1(totals.carbsG),
    fatG: round1(totals.fatG),
    fiberG: round1(totals.fiberG),
  };
}
