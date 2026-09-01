import { z } from 'zod';

import type { FoodItem, NutritionPer100, ServingSize } from '@/domain/food/types';

/**
 * Traduction d'un produit Open Food Facts en `FoodItem` du domaine.
 *
 * Tout ce que ce module sait d'OFF s'arrête à sa frontière : au-delà, plus
 * personne dans l'app ne connaît le nom d'un champ de l'API.
 *
 * Le principe qui gouverne tout le fichier : **la donnée OFF est
 * collaborative** (PHASES_2_A_5 §4.2). Un champ manquant est le cas normal, pas
 * l'exception. Aucune valeur n'est inventée, aucune n'est supposée nulle — un
 * produit dont on ignore les lipides n'est pas un produit à 0 g de lipides, et
 * le journaliser comme tel fausserait les totaux sans que personne le voie.
 */

/**
 * Identifiant local d'un produit OFF, dérivé du code-barres.
 *
 * Déterministe volontairement : rescanner le même produit met à jour la ligne
 * existante au lieu d'en créer une seconde. Le préfixe garde par ailleurs la
 * frontière ODbL lisible à l'œil nu dans la base (voir `licence.ts`).
 */
export function offItemId(barcode: string): string {
  return `off:${barcode}`;
}

/** Nutriments sans lesquels un aliment ne peut pas être journalisé. */
export const REQUIRED_NUTRIENTS = ['kcal', 'proteinG', 'carbsG', 'fatG'] as const;
export type RequiredNutrient = (typeof REQUIRED_NUTRIENTS)[number];

/**
 * Ébauche d'aliment : ce qu'on a pu tirer d'un produit incomplet.
 *
 * Sert à pré-remplir le formulaire de saisie manuelle. Retrouver le nom et la
 * marque évite de faire retaper ce que la source connaissait déjà, alors même
 * qu'elle ignorait les nutriments.
 */
export interface FoodDraft {
  barcode?: string;
  name: string;
  brand?: string;
  nutritionPer100: Partial<NutritionPer100>;
  servingSizes: ServingSize[];
}

export type ProductMapping =
  | { status: 'found'; item: FoodItem }
  | { status: 'incomplete'; draft: FoodDraft; missing: RequiredNutrient[] }
  /** Ni nom ni code exploitable : la fiche est trop creuse pour servir à quoi que ce soit. */
  | { status: 'unusable' };

// --- Contrat d'entrée -------------------------------------------------------

/**
 * Schéma volontairement **permissif**.
 *
 * Chaque champ est optionnel parce qu'OFF les rend tous optionnels dans les
 * faits. `catch` neutralise les valeurs aberrantes — une chaîne là où un nombre
 * est attendu, ce qui arrive sur des fiches anciennes — sans faire échouer la
 * lecture entière : un produit à moitié lisible reste plus utile qu'une erreur.
 */
const numeric = z
  .union([z.number(), z.string()])
  .transform((value) => (typeof value === 'number' ? value : Number.parseFloat(value)))
  .refine((value) => Number.isFinite(value) && value >= 0)
  .optional()
  .catch(undefined);

const optionalText = z.string().optional().catch(undefined);

const nutrimentsSchema = z
  .object({
    'energy-kcal_100g': numeric,
    energy_100g: numeric,
    proteins_100g: numeric,
    carbohydrates_100g: numeric,
    fat_100g: numeric,
    fiber_100g: numeric,
    sugars_100g: numeric,
    'saturated-fat_100g': numeric,
    sodium_100g: numeric,
  })
  .catch({});

export const offProductSchema = z.looseObject({
  code: optionalText,
  product_name: optionalText,
  product_name_fr: optionalText,
  generic_name: optionalText,
  brands: optionalText,
  nutriments: nutrimentsSchema.optional().catch(undefined),
  serving_size: optionalText,
  serving_quantity: numeric,
});

export type OffProduct = z.infer<typeof offProductSchema>;

/**
 * Champs demandés à l'API.
 *
 * Limiter la charge utile n'est pas une micro-optimisation : les fiches OFF
 * complètes pèsent des dizaines de kilo-octets d'images et de tags dont on
 * n'affiche rien, sur des connexions mobiles et sous quota d'appels.
 */
export const OFF_PRODUCT_FIELDS = [
  'code',
  'product_name',
  'product_name_fr',
  'generic_name',
  'brands',
  'nutriments',
  'serving_size',
  'serving_quantity',
] as const;

// --- Conversion -------------------------------------------------------------

/** 1 kcal = 4,184 kJ. Certaines fiches n'ont que l'énergie en kilojoules. */
const KJ_PER_KCAL = 4.184;
/** OFF exprime le sodium en grammes ; notre modèle le stocke en milligrammes. */
const MG_PER_G = 1000;

type OffNutriments = NonNullable<OffProduct['nutriments']>;

function readEnergyKcal(nutriments: OffNutriments): number | undefined {
  const kcal = nutriments['energy-kcal_100g'];

  if (kcal !== undefined) {
    return kcal;
  }

  // Repli sur les kilojoules plutôt qu'abandon : sur les fiches européennes
  // anciennes, c'est souvent la seule énergie renseignée.
  const kj = nutriments.energy_100g;
  return kj === undefined ? undefined : Math.round(kj / KJ_PER_KCAL);
}

function readNutrition(product: OffProduct): Partial<NutritionPer100> {
  const nutriments: OffNutriments = product.nutriments ?? {};
  const kcal = readEnergyKcal(nutriments);
  const sodiumG = nutriments.sodium_100g;
  const saturatedFatG = nutriments['saturated-fat_100g'];

  return {
    ...(kcal === undefined ? {} : { kcal }),
    ...(nutriments.proteins_100g === undefined ? {} : { proteinG: nutriments.proteins_100g }),
    ...(nutriments.carbohydrates_100g === undefined
      ? {}
      : { carbsG: nutriments.carbohydrates_100g }),
    ...(nutriments.fat_100g === undefined ? {} : { fatG: nutriments.fat_100g }),
    ...(nutriments.fiber_100g === undefined ? {} : { fiberG: nutriments.fiber_100g }),
    ...(nutriments.sugars_100g === undefined ? {} : { sugarG: nutriments.sugars_100g }),
    ...(saturatedFatG === undefined ? {} : { saturatedFatG }),
    ...(sodiumG === undefined ? {} : { sodiumMg: Math.round(sodiumG * MG_PER_G) }),
  };
}

/** Le nom français d'abord : l'app est francophone. */
function readName(product: OffProduct): string | undefined {
  for (const candidate of [product.product_name_fr, product.product_name, product.generic_name]) {
    const trimmed = candidate?.trim();

    if (trimmed !== undefined && trimmed !== '') {
      return trimmed;
    }
  }

  return undefined;
}

/** `brands` est une liste séparée par des virgules ; la première suffit à l'affichage. */
function readBrand(product: OffProduct): string | undefined {
  const first = product.brands?.split(',')[0]?.trim();
  return first === undefined || first === '' ? undefined : first;
}

function readServingSizes(product: OffProduct): ServingSize[] {
  const grams = product.serving_quantity;

  if (grams === undefined || grams <= 0) {
    return [];
  }

  const label = product.serving_size?.trim();
  return [{ label: label === undefined || label === '' ? 'Portion' : label, grams }];
}

function missingNutrients(nutrition: Partial<NutritionPer100>): RequiredNutrient[] {
  return REQUIRED_NUTRIENTS.filter((key) => nutrition[key] === undefined);
}

/**
 * Convertit un produit OFF déjà validé.
 *
 * @param cachedAt horodatage de mise en cache, injecté pour rester pur.
 */
export function mapOffProduct(product: OffProduct, cachedAt: string): ProductMapping {
  const name = readName(product);
  const barcode = product.code?.trim();

  // Sans nom ni code, il ne reste rien à afficher ni à mettre en cache.
  if (name === undefined || barcode === undefined || barcode === '') {
    return { status: 'unusable' };
  }

  const nutrition = readNutrition(product);
  const missing = missingNutrients(nutrition);
  const brand = readBrand(product);
  const servingSizes = readServingSizes(product);

  if (missing.length > 0) {
    return {
      status: 'incomplete',
      missing,
      draft: {
        barcode,
        name,
        ...(brand === undefined ? {} : { brand }),
        nutritionPer100: nutrition,
        servingSizes,
      },
    };
  }

  return {
    status: 'found',
    item: {
      id: offItemId(barcode),
      source: 'off',
      barcode,
      name,
      ...(brand === undefined ? {} : { brand }),
      // Le transtypage est sûr : `missing` vide prouve que les quatre nutriments
      // obligatoires sont présents, ce que le typage structurel ne voit pas.
      nutritionPer100: nutrition as NutritionPer100,
      servingSizes,
      /**
       * Jamais `true` pour une donnée OFF, quelle que soit sa complétude :
       * `verified` veut dire « quelqu'un a lu l'étiquette », et sur une base
       * collaborative personne ne peut l'affirmer. Seuls les aliments saisis
       * par l'utilisateur le sont (`food.repo.createCustom`).
       */
      verified: false,
      cachedAt,
    },
  };
}

/** Parse puis convertit. Une fiche illisible est traitée comme inexploitable. */
export function parseOffProduct(raw: unknown, cachedAt: string): ProductMapping {
  const parsed = offProductSchema.safeParse(raw);
  return parsed.success ? mapOffProduct(parsed.data, cachedAt) : { status: 'unusable' };
}
