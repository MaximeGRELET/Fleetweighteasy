import { createConsentRepository, type ConsentRepository } from './consent.repo';
import type { RepositoryContext } from './context';
import { createFoodLogRepository, type FoodLogRepository } from './food-log.repo';
import { createFoodRepository, type FoodRepository } from './food.repo';
import { createMealRepository, type MealRepository } from './meal.repo';
import { createProfileRepository, type ProfileRepository } from './profile.repo';
import { createWeightRepository, type WeightRepository } from './weight.repo';
import { createWorkoutRepository, type WorkoutRepository } from './workout.repo';

/**
 * L'ensemble des repositories, assemblés sur un même contexte.
 *
 * Ce module n'ouvre aucune base : il ne dépend ni d'`expo-sqlite`, ni de
 * l'horloge système. C'est ce qui permet aux tests de faire tourner de vrais
 * écrans sur de vrais repositories, adossés à une base en mémoire.
 */
export interface Repositories {
  consent: ConsentRepository;
  profile: ProfileRepository;
  food: FoodRepository;
  meal: MealRepository;
  foodLog: FoodLogRepository;
  weight: WeightRepository;
  workout: WorkoutRepository;
}

export function createRepositories(context: RepositoryContext): Repositories {
  return {
    consent: createConsentRepository(context),
    profile: createProfileRepository(context),
    food: createFoodRepository(context),
    meal: createMealRepository(context),
    foodLog: createFoodLogRepository(context),
    weight: createWeightRepository(context),
    workout: createWorkoutRepository(context),
  };
}
