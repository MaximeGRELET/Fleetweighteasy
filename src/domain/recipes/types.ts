import type { MealType } from '@/domain/journal/types';
import type { DietType } from '@/domain/profile/types';

/**
 * Modèle des recettes (Phase 7).
 *
 * `DietType` et `MealType` sont **importés**, jamais redéfinis : une notion de
 * régime parallèle à celle du profil finirait par diverger, et le filtrage des
 * recettes ne dirait plus la même chose que les conseils de la Phase 6.
 */

/**
 * Allergènes suivis, alignés sur les allergènes à déclaration obligatoire les
 * plus courants. La liste est fermée : une chaîne libre ici deviendrait une
 * exclusion silencieusement inopérante, sur le seul filtre dont la spec dit
 * qu'il est non négociable.
 */
export type Allergen =
  'gluten' | 'dairy' | 'eggs' | 'nuts' | 'peanuts' | 'soy' | 'shellfish' | 'fish' | 'sesame';

export const ALLERGENS: readonly Allergen[] = [
  'gluten',
  'dairy',
  'eggs',
  'nuts',
  'peanuts',
  'soy',
  'shellfish',
  'fish',
  'sesame',
];

export type RecipeTag =
  // Atout nutritionnel
  | 'high_protein'
  | 'high_fiber'
  | 'low_calorie'
  // Style et praticité
  | 'quick'
  | 'batch_cook'
  | 'one_pan'
  | 'no_cook'
  // Goûts
  | 'sweet'
  | 'savory'
  | 'spicy'
  | 'comfort'
  | 'fresh';

export type RecipeDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Origine alimentaire d'un ingrédient.
 *
 * C'est **elle** qui détermine les régimes incompatibles, et non une liste
 * saisie à la main par ingrédient. La table de référence du catalogue notait le
 * poulet comme excluant seulement `vegetarian` et `vegan` : un pescatarien se
 * serait donc vu proposer une salade de poulet. Une origine se vérifie d'un
 * coup d'œil, une liste d'exclusions se recopie et s'oublie.
 */
export type IngredientOrigin = 'plant' | 'honey' | 'dairy' | 'egg' | 'fish' | 'meat';

/**
 * État de référence des valeurs nutritionnelles.
 *
 * 100 g de riz cru ne sont pas 100 g de riz cuit — le premier pèse près de
 * trois fois plus une fois cuit, et les valeurs par 100 g s'effondrent en
 * conséquence. Les quantités des recettes sont exprimées **dans cet état**, et
 * l'affichage doit le rappeler pour que personne ne pèse au mauvais moment.
 */
export type IngredientState = 'raw' | 'cooked' | 'as_sold';

/** Valeurs pour 100 g (ou 100 ml pour les liquides), dans l'état indiqué. */
export interface IngredientNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface IngredientRef {
  id: string;
  /** Nom français, affiché tel quel. */
  name: string;
  state: IngredientState;
  per100g: IngredientNutrition;
  origin: IngredientOrigin;
  /** Allergènes présents, hérités par toute recette qui utilise l'ingrédient. */
  allergens: readonly Allergen[];
}

export interface RecipeIngredient {
  /** Identifiant dans la table de référence. */
  refId: string;
  /** Quantité en grammes (ou millilitres), pour la recette **entière**. */
  quantityG: number;
  /** Précision d'affichage, ex. « 2 œufs ». */
  display?: string;
}

export interface Recipe {
  id: string;
  name: string;
  mealTypes: readonly MealType[];
  tags: readonly RecipeTag[];
  ingredients: readonly RecipeIngredient[];
  steps: readonly string[];
  prepTimeMin: number;
  difficulty: RecipeDifficulty;
  /** Nombre de portions que produit la recette entière. */
  servings: number;
}

/**
 * Recette enrichie de tout ce qui se déduit de ses ingrédients.
 *
 * Allergènes, compatibilité régime et nutrition ne sont **jamais** saisis à la
 * main : ils sont calculés, donc impossibles à oublier lors de l'ajout d'une
 * recette (BRIEF_RECETTES §4).
 */
export interface ResolvedRecipe extends Recipe {
  allergens: readonly Allergen[];
  /** Régimes compatibles, déduits de l'origine des ingrédients. */
  dietTypes: readonly DietType[];
  /** Valeurs pour **une** portion. */
  nutritionPerServing: RecipeNutrition;
  /** Poids d'une portion, en grammes crus/préparés selon l'état des ingrédients. */
  servingWeightG: number;
}

export interface RecipeNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
