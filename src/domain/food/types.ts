/**
 * Modèle des aliments et des repas prédéfinis.
 *
 * TypeScript pur : ces types sont partagés par la data (persistance), les hooks
 * et l'UI. Ils ne savent pas d'où vient la donnée (Open Food Facts, saisie
 * maison, cache local).
 */

/** Origine de la donnée nutritionnelle. */
export type FoodSource = 'off' | 'custom';

/** Portion usuelle, par ex. « 1 tranche » = 30 g. */
export interface ServingSize {
  label: string;
  grams: number;
}

/** Valeurs nutritionnelles pour 100 g (ou 100 ml). */
export interface NutritionPer100 {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
}

export interface FoodItem {
  id: string;
  source: FoodSource;
  barcode?: string;
  name: string;
  brand?: string;
  nutritionPer100: NutritionPer100;
  servingSizes: ServingSize[];
  /**
   * Fiabilité de la donnée. Open Food Facts est collaboratif : les valeurs sont
   * parfois incomplètes ou erronées (PLAN_IMPLEMENTATION §6.2). L'UI l'indique
   * et laisse l'utilisateur corriger.
   */
  verified: boolean;
  /** Horodatage ISO 8601 de la mise en cache locale. */
  cachedAt: string;
}

/** Un composant d'un repas prédéfini. */
export interface MealItem {
  foodItemId: string;
  quantityG: number;
}

/** Repas prédéfini : une composition réutilisable, loggée en un tap. */
export interface Meal {
  id: string;
  name: string;
  items: MealItem[];
  createdAt: string;
}
