import { asc, eq } from 'drizzle-orm';

import { meal } from '@/data/db/schema';
import { markDeleted, markDirty } from '@/data/db/sync-meta';
import { toMeal, toMealInsert } from '@/data/types';
import type { Meal, MealItem } from '@/domain/food/types';

import type { RepositoryContext } from './context';

/** Repas prédéfinis : compositions réutilisables, loggées en un tap. */
export interface MealRepository {
  getById(id: string): Meal | undefined;
  listAll(): Meal[];
  create(input: { name: string; items: MealItem[] }): Meal;
  update(entity: Meal): Meal;
  remove(id: string): void;
}

export function createMealRepository(context: RepositoryContext): MealRepository {
  const { db, generateId, now } = context;

  function persist(entity: Meal): Meal {
    const at = now();
    const values = toMealInsert(entity);

    db.transaction((tx) => {
      tx.insert(meal).values(values).onConflictDoUpdate({ target: meal.id, set: values }).run();
      markDirty(tx, 'meal', entity.id, at);
    });

    return entity;
  }

  return {
    getById(id) {
      const row = db.select().from(meal).where(eq(meal.id, id)).get();
      return row ? toMeal(row) : undefined;
    },

    listAll() {
      return db.select().from(meal).orderBy(asc(meal.name)).all().map(toMeal);
    },

    create(input) {
      return persist({
        id: generateId(),
        name: input.name,
        items: input.items,
        createdAt: now().toISOString(),
      });
    },

    update(entity) {
      return persist(entity);
    },

    remove(id) {
      const at = now();

      db.transaction((tx) => {
        tx.delete(meal).where(eq(meal.id, id)).run();
        markDeleted(tx, 'meal', id, at);
      });
    },
  };
}
