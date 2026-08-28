import { asc, eq, sql } from 'drizzle-orm';

import { foodItem } from '@/data/db/schema';
import { markDeleted, markDirty } from '@/data/db/sync-meta';
import { toFoodItem, toFoodItemInsert } from '@/data/types';
import type { FoodItem, NutritionPer100, ServingSize } from '@/domain/food/types';

import type { RepositoryContext } from './context';

/**
 * Aliments : cache des produits Open Food Facts et aliments maison.
 *
 * Le cache est ce qui rend le journal utilisable hors ligne : tout produit
 * consulté est conservé localement (PLAN_IMPLEMENTATION §6.2).
 */
export interface NewCustomFoodItem {
  name: string;
  brand?: string;
  barcode?: string;
  nutritionPer100: NutritionPer100;
  servingSizes?: ServingSize[];
}

export interface FoodRepository {
  getById(id: string): FoodItem | undefined;
  getByBarcode(barcode: string): FoodItem | undefined;
  /** Recherche locale par nom, insensible à la casse. */
  searchByName(query: string, limit?: number): FoodItem[];
  /** Met en cache un produit distant, ou remplace un aliment existant. */
  upsert(item: FoodItem): FoodItem;
  /** Crée un aliment maison. Toujours `verified`, c'est l'utilisateur qui le saisit. */
  createCustom(input: NewCustomFoodItem): FoodItem;
  listCustom(): FoodItem[];
  remove(id: string): void;
  count(): number;
}

const DEFAULT_SEARCH_LIMIT = 50;

/** Caractère d'échappement de la clause `LIKE ... ESCAPE`. */
const LIKE_ESCAPE_CHARACTER = '\\';

/**
 * Seuls les aliments maison sont des données utilisateur à synchroniser.
 * Le cache Open Food Facts est reconstructible depuis le réseau : le pousser
 * au serveur gonflerait la synchro sans rien apporter.
 */
function isUserOwned(item: FoodItem): boolean {
  return item.source === 'custom';
}

export function createFoodRepository(context: RepositoryContext): FoodRepository {
  const { db, generateId, now } = context;

  function persist(item: FoodItem): FoodItem {
    const at = now();
    const values = toFoodItemInsert(item);

    db.transaction((tx) => {
      tx.insert(foodItem)
        .values(values)
        .onConflictDoUpdate({ target: foodItem.id, set: values })
        .run();

      if (isUserOwned(item)) {
        markDirty(tx, 'food_item', item.id, at);
      }
    });

    return item;
  }

  return {
    getById(id) {
      const row = db.select().from(foodItem).where(eq(foodItem.id, id)).get();
      return row ? toFoodItem(row) : undefined;
    },

    getByBarcode(barcode) {
      const row = db.select().from(foodItem).where(eq(foodItem.barcode, barcode)).get();
      return row ? toFoodItem(row) : undefined;
    },

    searchByName(query, limit = DEFAULT_SEARCH_LIMIT) {
      const trimmed = query.trim();

      if (trimmed.length === 0) {
        return [];
      }

      // LIKE est insensible à la casse en SQLite pour l'ASCII. La clause ESCAPE
      // est indispensable : sans elle, un « % » saisi par l'utilisateur
      // ramènerait tout le catalogue.
      const pattern = `%${escapeLike(trimmed)}%`;

      return db
        .select()
        .from(foodItem)
        .where(sql`${foodItem.name} like ${pattern} escape ${LIKE_ESCAPE_CHARACTER}`)
        .orderBy(asc(foodItem.name))
        .limit(limit)
        .all()
        .map(toFoodItem);
    },

    upsert(item) {
      return persist(item);
    },

    createCustom(input) {
      const at = now();

      return persist({
        id: generateId(),
        source: 'custom',
        ...(input.barcode === undefined ? {} : { barcode: input.barcode }),
        name: input.name,
        ...(input.brand === undefined ? {} : { brand: input.brand }),
        nutritionPer100: input.nutritionPer100,
        servingSizes: input.servingSizes ?? [],
        verified: true,
        cachedAt: at.toISOString(),
      });
    },

    listCustom() {
      return db
        .select()
        .from(foodItem)
        .where(eq(foodItem.source, 'custom'))
        .orderBy(asc(foodItem.name))
        .all()
        .map(toFoodItem);
    },

    remove(id) {
      const at = now();

      db.transaction((tx) => {
        const existing = tx.select().from(foodItem).where(eq(foodItem.id, id)).get();

        if (!existing) {
          return;
        }

        tx.delete(foodItem).where(eq(foodItem.id, id)).run();

        if (existing.source === 'custom') {
          markDeleted(tx, 'food_item', id, at);
        }
      });
    },

    count() {
      return db.select().from(foodItem).all().length;
    },
  };
}

/** Neutralise les jokers `%` et `_` pour qu'ils soient cherchés littéralement. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `${LIKE_ESCAPE_CHARACTER}${character}`);
}
