import { z } from 'zod';

import type { FoodItem, Meal, MealItem, ServingSize } from '@/domain/food/types';
import type { FoodLogEntry } from '@/domain/journal/types';
import type { WeightEntry } from '@/domain/progress/types';
import type { UserProfile } from '@/domain/profile/types';
import type { WorkoutLogEntry, WorkoutPayload } from '@/domain/training/types';

import {
  consent,
  foodItem,
  foodLogEntry,
  meal,
  profile,
  weightEntry,
  workoutLogEntry,
} from './db/schema';
import { DataIntegrityError } from './errors';

/**
 * Mappers rangée SQLite ↔ type du domaine.
 *
 * Toute la connaissance du format de stockage est concentrée ici : les
 * repositories manipulent des types du domaine, jamais des rangées. Les colonnes
 * JSON sont validées à la lecture — une base corrompue doit échouer bruyamment,
 * pas se propager silencieusement dans les calculs nutritionnels.
 */

export type ProfileRow = typeof profile.$inferSelect;
export type ProfileInsert = typeof profile.$inferInsert;
export type ConsentRow = typeof consent.$inferSelect;
export type ConsentInsert = typeof consent.$inferInsert;
export type FoodItemRow = typeof foodItem.$inferSelect;
export type FoodItemInsert = typeof foodItem.$inferInsert;
export type MealRow = typeof meal.$inferSelect;
export type MealInsert = typeof meal.$inferInsert;
export type FoodLogEntryRow = typeof foodLogEntry.$inferSelect;
export type FoodLogEntryInsert = typeof foodLogEntry.$inferInsert;
export type WeightEntryRow = typeof weightEntry.$inferSelect;
export type WeightEntryInsert = typeof weightEntry.$inferInsert;
export type WorkoutLogEntryRow = typeof workoutLogEntry.$inferSelect;
export type WorkoutLogEntryInsert = typeof workoutLogEntry.$inferInsert;

/** Identifiants des tables à ligne unique (contraints par un CHECK en base). */
export const PROFILE_ROW_ID = 1;
export const CONSENT_ROW_ID = 1;

// --- Schémas des colonnes JSON ---------------------------------------------

const stringArraySchema = z.array(z.string());

const servingSizesSchema = z.array(z.object({ label: z.string(), grams: z.number().positive() }));

const mealItemsSchema = z.array(
  z.object({ foodItemId: z.string(), quantityG: z.number().positive() }),
);

const cardioPayloadSchema = z.object({
  type: z.literal('cardio'),
  activity: z.enum(['walking', 'running', 'cycling']),
  metEntryId: z.string(),
  durationMin: z.number().nonnegative(),
  distanceKm: z.number().nonnegative().optional(),
});

const strengthPayloadSchema = z.object({
  type: z.literal('strength'),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      name: z.string(),
      sets: z.array(
        z.object({
          reps: z.number().int().nonnegative(),
          weightKg: z.number().nonnegative().optional(),
        }),
      ),
    }),
  ),
  durationMin: z.number().nonnegative().optional(),
});

const workoutPayloadSchema = z.discriminatedUnion('type', [
  cardioPayloadSchema,
  strengthPayloadSchema,
]);

function parseJsonColumn<T>(schema: z.ZodType<T>, raw: string, field: string): T {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DataIntegrityError(field, `Colonne JSON illisible : ${field}.`);
  }

  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new DataIntegrityError(field, `Colonne JSON malformée : ${field}.`);
  }

  return result.data;
}

// --- Profil ----------------------------------------------------------------

export function toUserProfile(row: ProfileRow): UserProfile {
  return {
    sex: row.sex,
    birthDate: row.birthDate,
    heightCm: row.heightCm,
    currentWeightKg: row.currentWeightKg,
    goalType: row.goalType,
    ...(row.targetWeightKg === null ? {} : { targetWeightKg: row.targetWeightKg }),
    ...(row.weeklyRateKg === null ? {} : { weeklyRateKg: row.weeklyRateKg }),
    activityLevel: row.activityLevel,
    trainingDaysPerWeek: row.trainingDaysPerWeek,
    dietType: row.dietType,
    allergies: parseJsonColumn(stringArraySchema, row.allergies, 'profile.allergies'),
    dislikes: parseJsonColumn(stringArraySchema, row.dislikes, 'profile.dislikes'),
    calorieMode: row.calorieMode,
    onboardingCompleted: row.onboardingCompleted,
  };
}

export function toProfileInsert(
  userProfile: UserProfile,
  metadata: { createdAt: string; updatedAt: string },
): ProfileInsert {
  return {
    id: PROFILE_ROW_ID,
    sex: userProfile.sex,
    birthDate: userProfile.birthDate,
    heightCm: userProfile.heightCm,
    currentWeightKg: userProfile.currentWeightKg,
    goalType: userProfile.goalType,
    targetWeightKg: userProfile.targetWeightKg ?? null,
    weeklyRateKg: userProfile.weeklyRateKg ?? null,
    activityLevel: userProfile.activityLevel,
    trainingDaysPerWeek: userProfile.trainingDaysPerWeek,
    dietType: userProfile.dietType,
    allergies: JSON.stringify(userProfile.allergies),
    dislikes: JSON.stringify(userProfile.dislikes),
    calorieMode: userProfile.calorieMode,
    onboardingCompleted: userProfile.onboardingCompleted,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  };
}

// --- Aliments --------------------------------------------------------------

export function toFoodItem(row: FoodItemRow): FoodItem {
  const servingSizes: ServingSize[] = parseJsonColumn(
    servingSizesSchema,
    row.servingSizes,
    'food_item.serving_sizes',
  );

  return {
    id: row.id,
    source: row.source,
    ...(row.barcode === null ? {} : { barcode: row.barcode }),
    name: row.name,
    ...(row.brand === null ? {} : { brand: row.brand }),
    nutritionPer100: {
      kcal: row.kcalPer100,
      proteinG: row.proteinGPer100,
      carbsG: row.carbsGPer100,
      fatG: row.fatGPer100,
      ...(row.fiberGPer100 === null ? {} : { fiberG: row.fiberGPer100 }),
      ...(row.sugarGPer100 === null ? {} : { sugarG: row.sugarGPer100 }),
      ...(row.saturatedFatGPer100 === null ? {} : { saturatedFatG: row.saturatedFatGPer100 }),
      ...(row.sodiumMgPer100 === null ? {} : { sodiumMg: row.sodiumMgPer100 }),
    },
    servingSizes,
    verified: row.verified,
    cachedAt: row.cachedAt,
  };
}

export function toFoodItemInsert(item: FoodItem): FoodItemInsert {
  const per100 = item.nutritionPer100;

  return {
    id: item.id,
    source: item.source,
    barcode: item.barcode ?? null,
    name: item.name,
    brand: item.brand ?? null,
    kcalPer100: per100.kcal,
    proteinGPer100: per100.proteinG,
    carbsGPer100: per100.carbsG,
    fatGPer100: per100.fatG,
    fiberGPer100: per100.fiberG ?? null,
    sugarGPer100: per100.sugarG ?? null,
    saturatedFatGPer100: per100.saturatedFatG ?? null,
    sodiumMgPer100: per100.sodiumMg ?? null,
    servingSizes: JSON.stringify(item.servingSizes),
    verified: item.verified,
    cachedAt: item.cachedAt,
  };
}

// --- Repas prédéfinis ------------------------------------------------------

export function toMeal(row: MealRow): Meal {
  const items: MealItem[] = parseJsonColumn(mealItemsSchema, row.items, 'meal.items');

  return { id: row.id, name: row.name, items, createdAt: row.createdAt };
}

export function toMealInsert(entity: Meal): MealInsert {
  return {
    id: entity.id,
    name: entity.name,
    items: JSON.stringify(entity.items),
    createdAt: entity.createdAt,
  };
}

// --- Journal ---------------------------------------------------------------

export function toFoodLogEntry(row: FoodLogEntryRow): FoodLogEntry {
  return {
    id: row.id,
    date: row.date,
    mealType: row.mealType,
    ...(row.foodItemId === null ? {} : { foodItemId: row.foodItemId }),
    ...(row.mealId === null ? {} : { mealId: row.mealId }),
    quantityG: row.quantityG,
    snapshot: {
      name: row.nameSnapshot,
      kcal: row.kcalSnapshot,
      proteinG: row.proteinGSnapshot,
      carbsG: row.carbsGSnapshot,
      fatG: row.fatGSnapshot,
      ...(row.fiberGSnapshot === null ? {} : { fiberG: row.fiberGSnapshot }),
    },
    loggedAt: row.loggedAt,
  };
}

export function toFoodLogEntryInsert(entry: FoodLogEntry): FoodLogEntryInsert {
  return {
    id: entry.id,
    date: entry.date,
    mealType: entry.mealType,
    foodItemId: entry.foodItemId ?? null,
    mealId: entry.mealId ?? null,
    quantityG: entry.quantityG,
    nameSnapshot: entry.snapshot.name,
    kcalSnapshot: entry.snapshot.kcal,
    proteinGSnapshot: entry.snapshot.proteinG,
    carbsGSnapshot: entry.snapshot.carbsG,
    fatGSnapshot: entry.snapshot.fatG,
    fiberGSnapshot: entry.snapshot.fiberG ?? null,
    loggedAt: entry.loggedAt,
  };
}

// --- Poids -----------------------------------------------------------------

export function toWeightEntry(row: WeightEntryRow): WeightEntry {
  return {
    id: row.id,
    date: row.date,
    weightKg: row.weightKg,
    ...(row.note === null ? {} : { note: row.note }),
  };
}

export function toWeightEntryInsert(entry: WeightEntry): WeightEntryInsert {
  return { id: entry.id, date: entry.date, weightKg: entry.weightKg, note: entry.note ?? null };
}

// --- Séances ---------------------------------------------------------------

export function toWorkoutLogEntry(row: WorkoutLogEntryRow): WorkoutLogEntry {
  const payload: WorkoutPayload = parseJsonColumn(
    workoutPayloadSchema,
    row.payload,
    'workout_log_entry.payload',
  );

  if (payload.type !== row.type) {
    throw new DataIntegrityError(
      'workout_log_entry.payload',
      `Type de séance incohérent : colonne « ${row.type} », charge utile « ${payload.type} ».`,
    );
  }

  return {
    id: row.id,
    date: row.date,
    payload,
    ...(row.estimatedKcalBurned === null ? {} : { estimatedKcalBurned: row.estimatedKcalBurned }),
  };
}

export function toWorkoutLogEntryInsert(entry: WorkoutLogEntry): WorkoutLogEntryInsert {
  return {
    id: entry.id,
    date: entry.date,
    type: entry.payload.type,
    payload: JSON.stringify(entry.payload),
    estimatedKcalBurned: entry.estimatedKcalBurned ?? null,
  };
}
