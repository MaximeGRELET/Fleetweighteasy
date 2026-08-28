import { db } from '@/data/db/client';
import { createId } from '@/lib/id';

import { createConsentRepository } from './consent.repo';
import type { RepositoryContext } from './context';
import { createFoodLogRepository } from './food-log.repo';
import { createFoodRepository } from './food.repo';
import { createMealRepository } from './meal.repo';
import { createProfileRepository } from './profile.repo';
import { createWeightRepository } from './weight.repo';
import { createWorkoutRepository } from './workout.repo';

/**
 * Câblage des repositories sur la base de l'application.
 *
 * C'est le seul endroit qui associe les repositories à SQLite, aux UUID et à
 * l'horloge système. Les tests construisent leur propre contexte avec une base
 * en mémoire, une horloge figée et des identifiants déterministes.
 *
 * Les hooks (`src/hooks/`) consomment ces instances ; l'UI ne les importe
 * jamais directement — c'est vérifié par ESLint.
 */
const appContext: RepositoryContext = {
  db,
  generateId: createId,
  now: () => new Date(),
};

export const consentRepo = createConsentRepository(appContext);
export const profileRepo = createProfileRepository(appContext);
export const foodRepo = createFoodRepository(appContext);
export const mealRepo = createMealRepository(appContext);
export const foodLogRepo = createFoodLogRepository(appContext);
export const weightRepo = createWeightRepository(appContext);
export const workoutRepo = createWorkoutRepository(appContext);

export type { RepositoryContext } from './context';
export { type ConsentRecord, type ConsentRepository } from './consent.repo';
export { type FoodLogRepository } from './food-log.repo';
export { type FoodRepository, type NewCustomFoodItem } from './food.repo';
export { type MealRepository } from './meal.repo';
export { type ProfileRepository } from './profile.repo';
export { type WeightRepository } from './weight.repo';
export { type WorkoutRepository } from './workout.repo';
