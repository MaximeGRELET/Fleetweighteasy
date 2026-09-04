import type { IngredientRef } from '../types';

/**
 * Table d’ingrédients de référence.
 *
 * Transcription de `files/RECETTES_REDIGEES.md` §1. Valeurs pour 100 g (ou
 * 100 ml), **dans l’état indiqué** : 100 g de riz cru ne sont pas 100 g de riz
 * cuit, et les quantités des recettes sont exprimées dans le même état.
 *
 * ## Deux écarts assumés avec le document source
 *
 * Le document donnait par ingrédient une liste de régimes exclus. Elle est
 * remplacée ici par une **origine alimentaire**, dont les exclusions se
 * déduisent (`diet.ts`). La liste manuscrite était déjà fausse : le poulet et
 * le bœuf n’y excluaient pas `pescatarian`, alors que la recette de salade de
 * poulet, elle, se déclarait bien incompatible. Une origine ne se recopie pas.
 *
 * Le **miel** est classé d’origine animale, donc exclu du régime végétalien.
 * Le document ne l’excluait de rien. Aucune recette végétalienne du catalogue
 * n’en contient : le classement ne retire donc rien à personne aujourd’hui, et
 * évite une réclamation le jour où une recette au miel serait ajoutée.
 *
 * ⚠️ **Valeurs à revérifier avec une base officielle** (Ciqual pour la France)
 * avant toute mise en production : ce sont des ordres de grandeur de référence.
 */
export const INGREDIENTS: readonly IngredientRef[] = [
  // --- Viandes ------------------------------------------------------------
  {
    id: 'chicken_breast_raw',
    name: 'Blanc de poulet',
    state: 'raw',
    per100g: { kcal: 120, proteinG: 23, carbsG: 0, fatG: 2.6 },
    origin: 'meat',
    allergens: [],
  },
  {
    id: 'lean_beef_raw',
    name: 'Bœuf haché 5% MG',
    state: 'raw',
    per100g: { kcal: 137, proteinG: 21, carbsG: 0, fatG: 5 },
    origin: 'meat',
    allergens: [],
  },

  // --- Poissons -----------------------------------------------------------
  {
    id: 'salmon_raw',
    name: 'Saumon',
    state: 'raw',
    per100g: { kcal: 208, proteinG: 20, carbsG: 0, fatG: 13 },
    origin: 'fish',
    allergens: ['fish'],
  },
  {
    id: 'cod_raw',
    name: 'Cabillaud',
    state: 'raw',
    per100g: { kcal: 82, proteinG: 18, carbsG: 0, fatG: 0.7 },
    origin: 'fish',
    allergens: ['fish'],
  },
  {
    id: 'canned_tuna',
    name: 'Thon au naturel (égoutté)',
    state: 'cooked',
    per100g: { kcal: 116, proteinG: 26, carbsG: 0, fatG: 1 },
    origin: 'fish',
    allergens: ['fish'],
  },

  // --- Œufs et produits laitiers -------------------------------------------
  {
    id: 'egg',
    name: 'Œuf',
    state: 'raw',
    per100g: { kcal: 143, proteinG: 13, carbsG: 0.7, fatG: 10 },
    origin: 'egg',
    allergens: ['eggs'],
  },
  {
    id: 'greek_yogurt_0',
    name: 'Yaourt grec 0%',
    state: 'as_sold',
    per100g: { kcal: 59, proteinG: 10, carbsG: 3.6, fatG: 0.4 },
    origin: 'dairy',
    allergens: ['dairy'],
  },
  {
    id: 'skyr',
    name: 'Skyr nature',
    state: 'as_sold',
    per100g: { kcal: 63, proteinG: 11, carbsG: 4, fatG: 0.2 },
    origin: 'dairy',
    allergens: ['dairy'],
  },
  {
    id: 'fromage_blanc_0',
    name: 'Fromage blanc 0%',
    state: 'as_sold',
    per100g: { kcal: 47, proteinG: 8, carbsG: 4, fatG: 0.2 },
    origin: 'dairy',
    allergens: ['dairy'],
  },
  {
    id: 'cheese_emmental',
    name: 'Emmental',
    state: 'as_sold',
    per100g: { kcal: 380, proteinG: 28, carbsG: 0, fatG: 29 },
    origin: 'dairy',
    allergens: ['dairy'],
  },
  {
    id: 'milk_semi',
    name: 'Lait demi-écrémé',
    state: 'as_sold',
    per100g: { kcal: 47, proteinG: 3.3, carbsG: 4.8, fatG: 1.6 },
    origin: 'dairy',
    allergens: ['dairy'],
  },

  // --- Végétal riche en protéines ------------------------------------------
  {
    id: 'soy_milk',
    name: 'Boisson soja nature',
    state: 'as_sold',
    per100g: { kcal: 43, proteinG: 3.3, carbsG: 1.8, fatG: 1.8 },
    origin: 'plant',
    allergens: ['soy'],
  },
  {
    id: 'tofu_firm',
    name: 'Tofu ferme',
    state: 'as_sold',
    per100g: { kcal: 144, proteinG: 17, carbsG: 3, fatG: 8 },
    origin: 'plant',
    allergens: ['soy'],
  },

  // --- Céréales et féculents ------------------------------------------------
  {
    id: 'rolled_oats',
    name: 'Flocons d’avoine',
    state: 'raw',
    per100g: { kcal: 379, proteinG: 13, carbsG: 68, fatG: 6.5 },
    origin: 'plant',
    allergens: ['gluten'],
  },
  {
    id: 'granola',
    name: 'Granola',
    state: 'as_sold',
    per100g: { kcal: 470, proteinG: 10, carbsG: 64, fatG: 18 },
    origin: 'plant',
    allergens: ['gluten', 'nuts'],
  },
  {
    id: 'white_rice_raw',
    name: 'Riz blanc',
    state: 'raw',
    per100g: { kcal: 360, proteinG: 7, carbsG: 79, fatG: 0.6 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'quinoa_raw',
    name: 'Quinoa',
    state: 'raw',
    per100g: { kcal: 368, proteinG: 14, carbsG: 64, fatG: 6 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'lentils_raw',
    name: 'Lentilles corail/vertes',
    state: 'raw',
    per100g: { kcal: 352, proteinG: 25, carbsG: 60, fatG: 1 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'chickpeas_cooked',
    name: 'Pois chiches (cuits/conserve)',
    state: 'cooked',
    per100g: { kcal: 139, proteinG: 9, carbsG: 22, fatG: 2.6 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'red_beans_cooked',
    name: 'Haricots rouges (cuits/conserve)',
    state: 'cooked',
    per100g: { kcal: 127, proteinG: 9, carbsG: 22, fatG: 0.5 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'whole_wheat_wrap',
    name: 'Galette de blé (wrap)',
    state: 'as_sold',
    per100g: { kcal: 297, proteinG: 9, carbsG: 49, fatG: 7 },
    origin: 'plant',
    allergens: ['gluten'],
  },
  {
    id: 'bread_wholegrain',
    name: 'Pain complet',
    state: 'as_sold',
    per100g: { kcal: 247, proteinG: 10, carbsG: 41, fatG: 3.5 },
    origin: 'plant',
    allergens: ['gluten'],
  },
  {
    id: 'potato_raw',
    name: 'Pomme de terre',
    state: 'raw',
    per100g: { kcal: 77, proteinG: 2, carbsG: 17, fatG: 0.1 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'sweet_potato_raw',
    name: 'Patate douce',
    state: 'raw',
    per100g: { kcal: 86, proteinG: 1.6, carbsG: 20, fatG: 0.1 },
    origin: 'plant',
    allergens: [],
  },

  // --- Fruits et légumes ----------------------------------------------------
  {
    id: 'avocado',
    name: 'Avocat',
    state: 'as_sold',
    per100g: { kcal: 160, proteinG: 2, carbsG: 9, fatG: 15 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'banana',
    name: 'Banane',
    state: 'as_sold',
    per100g: { kcal: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'apple',
    name: 'Pomme',
    state: 'as_sold',
    per100g: { kcal: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'mixed_berries',
    name: 'Fruits rouges',
    state: 'as_sold',
    per100g: { kcal: 43, proteinG: 1, carbsG: 10, fatG: 0.3 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'spinach',
    name: 'Épinards frais',
    state: 'as_sold',
    per100g: { kcal: 23, proteinG: 2.9, carbsG: 1.4, fatG: 0.4 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'broccoli_raw',
    name: 'Brocoli',
    state: 'raw',
    per100g: { kcal: 34, proteinG: 2.8, carbsG: 7, fatG: 0.4 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'green_beans',
    name: 'Haricots verts',
    state: 'cooked',
    per100g: { kcal: 35, proteinG: 1.9, carbsG: 7, fatG: 0.2 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'bell_pepper',
    name: 'Poivron',
    state: 'raw',
    per100g: { kcal: 31, proteinG: 1, carbsG: 6, fatG: 0.3 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'tomato',
    name: 'Tomate',
    state: 'raw',
    per100g: { kcal: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'onion',
    name: 'Oignon',
    state: 'raw',
    per100g: { kcal: 40, proteinG: 1.1, carbsG: 9, fatG: 0.1 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'carrot',
    name: 'Carotte',
    state: 'raw',
    per100g: { kcal: 41, proteinG: 0.9, carbsG: 10, fatG: 0.2 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'cucumber',
    name: 'Concombre',
    state: 'raw',
    per100g: { kcal: 15, proteinG: 0.7, carbsG: 3.6, fatG: 0.1 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'mixed_vegetables',
    name: 'Légumes variés (mélange)',
    state: 'as_sold',
    per100g: { kcal: 40, proteinG: 2, carbsG: 8, fatG: 0.3 },
    origin: 'plant',
    allergens: [],
  },

  // --- Matières grasses, condiments, compléments ---------------------------
  {
    id: 'coconut_milk',
    name: 'Lait de coco',
    state: 'as_sold',
    per100g: { kcal: 197, proteinG: 2, carbsG: 3, fatG: 20 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'olive_oil',
    name: 'Huile d’olive',
    state: 'as_sold',
    per100g: { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'peanut_butter',
    name: 'Beurre de cacahuète',
    state: 'as_sold',
    per100g: { kcal: 588, proteinG: 25, carbsG: 20, fatG: 50 },
    origin: 'plant',
    allergens: ['peanuts'],
  },
  {
    id: 'walnuts',
    name: 'Noix',
    state: 'as_sold',
    per100g: { kcal: 654, proteinG: 15, carbsG: 14, fatG: 65 },
    origin: 'plant',
    allergens: ['nuts'],
  },
  {
    id: 'honey',
    name: 'Miel',
    state: 'as_sold',
    per100g: { kcal: 304, proteinG: 0.3, carbsG: 82, fatG: 0 },
    origin: 'honey',
    allergens: [],
  },
  {
    id: 'hummus',
    name: 'Houmous',
    state: 'as_sold',
    per100g: { kcal: 166, proteinG: 8, carbsG: 14, fatG: 10 },
    origin: 'plant',
    allergens: ['sesame'],
  },
  {
    id: 'protein_powder_whey',
    name: 'Protéine whey',
    state: 'as_sold',
    per100g: { kcal: 400, proteinG: 80, carbsG: 8, fatG: 6 },
    origin: 'dairy',
    allergens: ['dairy'],
  },
  {
    id: 'protein_powder_pea',
    name: 'Protéine de pois',
    state: 'as_sold',
    per100g: { kcal: 380, proteinG: 80, carbsG: 5, fatG: 6 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'curry_spices',
    name: 'Épices curry',
    state: 'as_sold',
    per100g: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    origin: 'plant',
    allergens: [],
  },
  {
    id: 'chia_seeds',
    name: 'Graines de chia',
    state: 'as_sold',
    per100g: { kcal: 486, proteinG: 17, carbsG: 42, fatG: 31 },
    origin: 'plant',
    allergens: [],
  },
];

/**
 * Ingrédients fréquemment mis de côté, proposés à l'onboarding.
 *
 * Choisis parmi ceux que le catalogue utilise réellement : les six suggestions
 * précédentes — coriandre, champignons, olives, foie, chou, anchois — ne
 * correspondaient à **aucun** ingrédient, si bien que les cocher n'écartait
 * jamais rien. Les libellés sont lus dans la table plutôt que recopiés, pour
 * qu'ils ne puissent pas s'en écarter.
 *
 * Une saisie libre reste évidemment possible : elle est conservée au profil
 * même quand aucune recette ne la contient — c'est la préférence de la
 * personne, pas un critère de filtrage.
 */
export const DISLIKE_SUGGESTION_IDS: readonly string[] = [
  'onion',
  'bell_pepper',
  'tofu_firm',
  'broccoli_raw',
  'spinach',
  'avocado',
];

export const COMMON_DISLIKE_SUGGESTIONS: readonly string[] = INGREDIENTS.filter((ingredient) =>
  DISLIKE_SUGGESTION_IDS.includes(ingredient.id),
).map((ingredient) => ingredient.name);

/** Index par identifiant, construit une fois. */
export const INGREDIENTS_BY_ID: ReadonlyMap<string, IngredientRef> = new Map(
  INGREDIENTS.map((ingredient) => [ingredient.id, ingredient]),
);
