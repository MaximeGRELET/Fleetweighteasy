import { useCallback, useMemo } from 'react';

import {
  snapshotForFoodItem,
  snapshotForMeal,
  sumDailyTotals,
  totalMealWeightG,
} from '@/domain/journal/snapshot';
import type { DailyTotals, FoodLogEntry, MealType } from '@/domain/journal/types';
import { MEAL_TYPES } from '@/domain/journal/types';
import type { FoodItem, Meal } from '@/domain/food/types';
import { useSessionStore } from '@/stores/session';

import { useRepositories } from './use-repositories';

/**
 * Journal alimentaire d'une journée.
 *
 * Entièrement local, donc entièrement disponible hors ligne : ajouter, corriger
 * et supprimer une entrée ne touchent jamais le réseau (PHASES_2_A_5 §4.7).
 *
 * Le calcul nutritionnel reste dans le domaine. Ce hook orchestre — il fige un
 * snapshot via `snapshotForFoodItem` / `snapshotForMeal`, puis le confie au
 * repository — mais ne multiplie jamais une valeur par une quantité lui-même.
 */

export interface MealSection {
  mealType: MealType;
  entries: FoodLogEntry[];
  kcal: number;
}

export interface JournalDay {
  date: string;
  entries: FoodLogEntry[];
  totals: DailyTotals;
  /** Les quatre repas, toujours dans le même ordre, même vides. */
  sections: MealSection[];
  /** Dépense cardio estimée du jour, pour le mode `credited`. */
  exerciseKcal: number;
}

export interface AddFoodEntryInput {
  item: FoodItem;
  quantityG: number;
  mealType: MealType;
}

export interface AddMealEntryInput {
  meal: Meal;
  servings: number;
  mealType: MealType;
}

export interface UpdateEntryInput {
  quantityG: number;
  /** Permet aussi de déplacer une entrée d'un repas à l'autre. */
  mealType?: MealType;
}

export interface JournalController extends JournalDay {
  addFoodEntry: (input: AddFoodEntryInput) => FoodLogEntry;
  addMealEntry: (input: AddMealEntryInput) => FoodLogEntry;
  /**
   * Corrige une entrée existante.
   *
   * Le snapshot est **refait** depuis l'aliment d'origine, jamais mis à
   * l'échelle : appliquer une règle de trois à des valeurs déjà arrondies
   * ferait dériver l'historique à chaque correction.
   */
  updateEntry: (entryId: string, changes: UpdateEntryInput) => FoodLogEntry;
  removeEntry: (entryId: string) => void;
}

/** Lecture seule du journal d'une date. */
export function useJournalDay(date: string): JournalDay {
  const repositories = useRepositories();
  const journalRevision = useSessionStore((state) => state.journalRevision);

  return useMemo(() => {
    const entries = repositories.foodLog.getByDate(date);

    return {
      date,
      entries,
      totals: sumDailyTotals(entries),
      sections: MEAL_TYPES.map((mealType) => {
        const forMeal = entries.filter((entry) => entry.mealType === mealType);

        return {
          mealType,
          entries: forMeal,
          kcal: sumDailyTotals(forMeal).kcal,
        };
      }),
      exerciseKcal: repositories.workout.getEstimatedKcalForDate(date),
    };
    // `journalRevision` provoque la relecture après chaque écriture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositories, date, journalRevision]);
}

/** Journal d'une date, avec ses opérations d'écriture. */
export function useJournal(date: string): JournalController {
  const repositories = useRepositories();
  const bump = useSessionStore((state) => state.bumpJournalRevision);
  const day = useJournalDay(date);

  const addFoodEntry = useCallback(
    ({ item, quantityG, mealType }: AddFoodEntryInput) => {
      // L'aliment est (re)mis en cache à l'ajout : une entrée de journal doit
      // rester consultable même si le produit n'était pas encore local.
      repositories.food.upsert(item);

      const entry = repositories.foodLog.addEntry({
        date,
        mealType,
        foodItemId: item.id,
        quantityG,
        snapshot: snapshotForFoodItem(item, quantityG),
      });

      bump();
      return entry;
    },
    [repositories, date, bump],
  );

  const addMealEntry = useCallback(
    ({ meal, servings, mealType }: AddMealEntryInput) => {
      const entry = repositories.foodLog.addEntry({
        date,
        mealType,
        mealId: meal.id,
        quantityG: totalMealWeightG(meal, servings),
        // Le résolveur lève si un composant manque : mieux vaut refuser l'ajout
        // que journaliser un repas amputé sans le dire.
        snapshot: snapshotForMeal(meal, (id) => repositories.food.getById(id), servings),
      });

      bump();
      return entry;
    },
    [repositories, date, bump],
  );

  const updateEntry = useCallback(
    (entryId: string, changes: UpdateEntryInput) => {
      const existing = repositories.foodLog.getById(entryId);

      if (!existing) {
        throw new Error(`Entrée de journal introuvable : ${entryId}.`);
      }

      const source = existing.foodItemId
        ? repositories.food.getById(existing.foodItemId)
        : undefined;

      if (!source) {
        // Sans l'aliment d'origine, refaire le snapshot reviendrait à inventer
        // des chiffres. Une entrée dont la source a disparu se supprime et se
        // ressaisit ; elle ne se corrige pas à l'aveugle.
        throw new Error(
          'Cette entrée ne peut être corrigée que si l’aliment d’origine est encore connu.',
        );
      }

      const updated = repositories.foodLog.replaceEntry(entryId, {
        date: existing.date,
        mealType: changes.mealType ?? existing.mealType,
        foodItemId: source.id,
        quantityG: changes.quantityG,
        snapshot: snapshotForFoodItem(source, changes.quantityG),
      });

      bump();
      return updated;
    },
    [repositories, bump],
  );

  const removeEntry = useCallback(
    (entryId: string) => {
      repositories.foodLog.remove(entryId);
      bump();
    },
    [repositories, bump],
  );

  return { ...day, addFoodEntry, addMealEntry, updateEntry, removeEntry };
}
