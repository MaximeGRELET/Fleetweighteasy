import { useCallback, useMemo } from 'react';

import type { NewCustomFoodItem } from '@/data/repositories';
import type { FoodItem, Meal, MealItem } from '@/domain/food/types';
import { useSessionStore } from '@/stores/session';

import { useRepositories } from './use-repositories';

/**
 * Aliments maison et repas prédéfinis.
 *
 * Deux fonctionnalités entièrement locales, donc entièrement hors ligne. Elles
 * sont aussi le **repli** de tous les chemins réseau : produit inconnu d'Open
 * Food Facts, fiche incomplète, ou pas de connexion du tout — dans les trois
 * cas, l'utilisateur peut saisir son aliment et continuer sa journée.
 */

export interface CustomFoodLibrary {
  items: FoodItem[];
  create: (input: NewCustomFoodItem) => FoodItem;
  remove: (id: string) => void;
}

export function useCustomFoods(): CustomFoodLibrary {
  const repositories = useRepositories();
  const journalRevision = useSessionStore((state) => state.journalRevision);
  const bump = useSessionStore((state) => state.bumpJournalRevision);

  const items = useMemo(
    () => repositories.food.listCustom(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repositories, journalRevision],
  );

  const create = useCallback(
    (input: NewCustomFoodItem) => {
      /**
       * Toujours une **création**, jamais une modification d'une ligne Open
       * Food Facts, y compris quand l'utilisateur part d'une fiche OFF
       * incomplète. Deux raisons qui pointent dans le même sens :
       *
       * - la donnée corrigée est la sienne, elle ne doit pas se mélanger à une
       *   base sous ODbL (voir `src/data/remote/licence.ts`) ;
       * - une ligne `custom` est synchronisée vers le serveur, une ligne `off`
       *   ne l'est pas : écraser la seconde perdrait la correction.
       */
      const created = repositories.food.createCustom(input);
      bump();
      return created;
    },
    [repositories, bump],
  );

  const remove = useCallback(
    (id: string) => {
      repositories.food.remove(id);
      bump();
    },
    [repositories, bump],
  );

  return { items, create, remove };
}

export interface MealLibrary {
  meals: Meal[];
  create: (input: { name: string; items: MealItem[] }) => Meal;
  update: (meal: Meal) => Meal;
  remove: (id: string) => void;
  /** Aliments composant un repas, dans l'ordre, ceux encore connus seulement. */
  resolveItems: (meal: Meal) => { item: FoodItem; quantityG: number }[];
}

export function useMeals(): MealLibrary {
  const repositories = useRepositories();
  const journalRevision = useSessionStore((state) => state.journalRevision);
  const bump = useSessionStore((state) => state.bumpJournalRevision);

  const meals = useMemo(
    () => repositories.meal.listAll(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repositories, journalRevision],
  );

  const create = useCallback(
    (input: { name: string; items: MealItem[] }) => {
      const created = repositories.meal.create(input);
      bump();
      return created;
    },
    [repositories, bump],
  );

  const update = useCallback(
    (meal: Meal) => {
      const updated = repositories.meal.update(meal);
      bump();
      return updated;
    },
    [repositories, bump],
  );

  const remove = useCallback(
    (id: string) => {
      repositories.meal.remove(id);
      bump();
    },
    [repositories, bump],
  );

  const resolveItems = useCallback(
    (meal: Meal) =>
      meal.items.flatMap((entry) => {
        const item = repositories.food.getById(entry.foodItemId);
        // Un composant supprimé depuis n'est pas affiché — mais il fera échouer
        // l'ajout au journal, qui lui refuse un repas incomplet.
        return item ? [{ item, quantityG: entry.quantityG }] : [];
      }),
    [repositories],
  );

  return { meals, create, update, remove, resolveItems };
}
