import { db } from '@/data/db/client';
import { createId } from '@/lib/id';

import type { RepositoryContext } from './context';
import { createRepositories, type Repositories } from './factory';

/**
 * Câblage des repositories sur la base de l'application.
 *
 * Seul module qui associe les repositories à SQLite, aux UUID et à l'horloge
 * système — et donc le seul qui importe `@/data/db/client`. Il est appelé une
 * fois par le layout racine, qui diffuse le résultat via `RepositoriesProvider`.
 *
 * Les tests ne passent jamais par ici : ils construisent leur propre contexte
 * avec `createRepositories`.
 */
export function createAppRepositories(): Repositories {
  const context: RepositoryContext = { db, generateId: createId, now: () => new Date() };
  return createRepositories(context);
}

export { createRepositories, type Repositories } from './factory';
export type { RepositoryContext } from './context';
export { type ConsentRecord, type ConsentRepository } from './consent.repo';
export { type FoodLogRepository } from './food-log.repo';
export { type FoodRepository, type NewCustomFoodItem } from './food.repo';
export { type MaintenanceRepository } from './maintenance.repo';
export { type MealRepository } from './meal.repo';
export { type ProfileRepository } from './profile.repo';
export { type WeightRepository } from './weight.repo';
export { type WorkoutRepository } from './workout.repo';
