import { and, asc, between, eq } from 'drizzle-orm';

import { foodLogEntry } from '@/data/db/schema';
import { markDeleted, markDirty } from '@/data/db/sync-meta';
import { toFoodLogEntry, toFoodLogEntryInsert } from '@/data/types';
import { sumDailyTotals } from '@/domain/journal/snapshot';
import type { DailyTotals, FoodLogEntry, MealType, NewFoodLogEntry } from '@/domain/journal/types';

import type { RepositoryContext } from './context';

/**
 * Journal alimentaire.
 *
 * Le snapshot nutritionnel reçu en entrée est persisté **tel quel** : ce
 * repository ne recalcule jamais de nutrition. Les valeurs viennent du domaine
 * (`snapshotForFoodItem` / `snapshotForMeal`) et sont figées à l'ajout, pour que
 * l'historique ne change jamais rétroactivement.
 */
export interface FoodLogRepository {
  getById(id: string): FoodLogEntry | undefined;
  /** Entrées d'une date `YYYY-MM-DD`, dans l'ordre d'ajout. */
  getByDate(date: string): FoodLogEntry[];
  getByDateRange(fromDate: string, toDate: string): FoodLogEntry[];
  getByMealType(date: string, mealType: MealType): FoodLogEntry[];
  addEntry(input: NewFoodLogEntry): FoodLogEntry;
  /**
   * Remplace une entrée. Le nouveau snapshot est fourni par l'appelant : une
   * modification de quantité doit repasser par le domaine, jamais par une
   * règle de trois improvisée ici.
   */
  replaceEntry(id: string, input: NewFoodLogEntry): FoodLogEntry;
  remove(id: string): void;
  /** Totaux du jour, sommés depuis les snapshots. */
  getDailyTotals(date: string): DailyTotals;
  /**
   * Date de la toute première entrée, ou `undefined` si le journal est vide.
   *
   * Sert au moteur de conseils à savoir depuis quand la personne utilise
   * l'application — une information qu'aucun calcul ne peut deviner, et qu'on
   * lit ici plutôt que de charger tout l'historique pour n'en garder qu'une
   * ligne.
   */
  getFirstEntryDate(): string | undefined;
}

export function createFoodLogRepository(context: RepositoryContext): FoodLogRepository {
  const { db, generateId, now } = context;

  function persist(entry: FoodLogEntry): FoodLogEntry {
    const at = now();
    const values = toFoodLogEntryInsert(entry);

    db.transaction((tx) => {
      tx.insert(foodLogEntry)
        .values(values)
        .onConflictDoUpdate({ target: foodLogEntry.id, set: values })
        .run();

      markDirty(tx, 'food_log_entry', entry.id, at);
    });

    return entry;
  }

  function selectByDate(date: string): FoodLogEntry[] {
    return db
      .select()
      .from(foodLogEntry)
      .where(eq(foodLogEntry.date, date))
      .orderBy(asc(foodLogEntry.loggedAt))
      .all()
      .map(toFoodLogEntry);
  }

  return {
    getById(id) {
      const row = db.select().from(foodLogEntry).where(eq(foodLogEntry.id, id)).get();
      return row ? toFoodLogEntry(row) : undefined;
    },

    getByDate: selectByDate,

    getByDateRange(fromDate, toDate) {
      return db
        .select()
        .from(foodLogEntry)
        .where(between(foodLogEntry.date, fromDate, toDate))
        .orderBy(asc(foodLogEntry.date), asc(foodLogEntry.loggedAt))
        .all()
        .map(toFoodLogEntry);
    },

    getByMealType(date, mealType) {
      return db
        .select()
        .from(foodLogEntry)
        .where(and(eq(foodLogEntry.date, date), eq(foodLogEntry.mealType, mealType)))
        .orderBy(asc(foodLogEntry.loggedAt))
        .all()
        .map(toFoodLogEntry);
    },

    addEntry(input) {
      return persist({ ...input, id: generateId(), loggedAt: now().toISOString() });
    },

    replaceEntry(id, input) {
      const existing = db.select().from(foodLogEntry).where(eq(foodLogEntry.id, id)).get();

      // La date d'ajout d'origine est conservée : l'entrée garde sa place dans
      // le fil du jour même après correction.
      return persist({ ...input, id, loggedAt: existing?.loggedAt ?? now().toISOString() });
    },

    remove(id) {
      const at = now();

      db.transaction((tx) => {
        tx.delete(foodLogEntry).where(eq(foodLogEntry.id, id)).run();
        markDeleted(tx, 'food_log_entry', id, at);
      });
    },

    getFirstEntryDate() {
      const row = db
        .select({ date: foodLogEntry.date })
        .from(foodLogEntry)
        .orderBy(asc(foodLogEntry.date))
        .limit(1)
        .get();

      return row?.date;
    },

    getDailyTotals(date) {
      return sumDailyTotals(selectByDate(date));
    },
  };
}
