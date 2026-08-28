/** Modèle du journal alimentaire. */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * Valeurs nutritionnelles **figées** d'une entrée de journal, pour la quantité
 * effectivement consommée.
 *
 * C'est le cœur de l'immuabilité de l'historique : une entrée ne recalcule
 * jamais ses valeurs depuis l'aliment source. Si le produit est corrigé plus
 * tard, le passé de l'utilisateur ne change pas.
 */
export interface NutritionSnapshot {
  /** Nom au moment de l'ajout : l'entrée reste lisible même sans source. */
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
}

export interface FoodLogEntry {
  id: string;
  /** Date civile `YYYY-MM-DD`. */
  date: string;
  mealType: MealType;
  /** Source de l'entrée. Absente si l'aliment ou le repas a été supprimé depuis. */
  foodItemId?: string;
  mealId?: string;
  quantityG: number;
  snapshot: NutritionSnapshot;
  /** Horodatage ISO 8601 de l'ajout. */
  loggedAt: string;
}

/** Une entrée à créer : l'identifiant et l'horodatage sont posés par le repository. */
export type NewFoodLogEntry = Omit<FoodLogEntry, 'id' | 'loggedAt'>;

export interface DailyTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}
