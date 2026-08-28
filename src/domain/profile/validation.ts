import { z } from 'zod';

import { getMaxWeeklyRateKg } from '@/domain/nutrition/safety';

import { getAge } from './age';
import {
  MAX_PLAUSIBLE_AGE_YEARS,
  MAX_PLAUSIBLE_HEIGHT_CM,
  MAX_PLAUSIBLE_WEIGHT_KG,
  MIN_PLAUSIBLE_AGE_YEARS,
  MIN_PLAUSIBLE_HEIGHT_CM,
  MIN_PLAUSIBLE_WEIGHT_KG,
} from './bmi';

/**
 * Schémas de validation de la saisie utilisateur.
 *
 * Ils vivent dans le domaine, pas dans l'UI : les bornes sont **les mêmes
 * constantes** que celles utilisées par les formules (PHASE_3 §3.5). Un écran
 * d'onboarding ne réécrit jamais une règle métier, il compose ces schémas.
 */

export const sexSchema = z.enum(['male', 'female']);
export const goalTypeSchema = z.enum(['weight_loss', 'recomposition', 'maintenance']);
export const activityLevelSchema = z.enum([
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extremely_active',
]);
export const dietTypeSchema = z.enum([
  'omnivore',
  'flexitarian',
  'pescatarian',
  'vegetarian',
  'vegan',
]);
export const calorieModeSchema = z.enum(['fixed', 'credited']);

export const heightCmSchema = z
  .number({ error: 'Indique ta taille en centimètres.' })
  .min(MIN_PLAUSIBLE_HEIGHT_CM, {
    error: `La taille doit être comprise entre ${MIN_PLAUSIBLE_HEIGHT_CM} et ${MAX_PLAUSIBLE_HEIGHT_CM} cm.`,
  })
  .max(MAX_PLAUSIBLE_HEIGHT_CM, {
    error: `La taille doit être comprise entre ${MIN_PLAUSIBLE_HEIGHT_CM} et ${MAX_PLAUSIBLE_HEIGHT_CM} cm.`,
  });

export const weightKgSchema = z
  .number({ error: 'Indique ton poids en kilogrammes.' })
  .min(MIN_PLAUSIBLE_WEIGHT_KG, {
    error: `Le poids doit être compris entre ${MIN_PLAUSIBLE_WEIGHT_KG} et ${MAX_PLAUSIBLE_WEIGHT_KG} kg.`,
  })
  .max(MAX_PLAUSIBLE_WEIGHT_KG, {
    error: `Le poids doit être compris entre ${MIN_PLAUSIBLE_WEIGHT_KG} et ${MAX_PLAUSIBLE_WEIGHT_KG} kg.`,
  });

/**
 * Date de naissance ISO. L'âge est vérifié via `getAge` : c'est la même
 * fonction que celle utilisée par les formules, donc jamais un calcul
 * d'âge parallèle qui pourrait diverger.
 */
export function buildBirthDateSchema(now: Date = new Date()) {
  return z.string().superRefine((value, context) => {
    let age: number;

    try {
      age = getAge(value, now);
    } catch {
      context.addIssue({ code: 'custom', message: 'Indique une date de naissance valide.' });
      return;
    }

    if (age < MIN_PLAUSIBLE_AGE_YEARS) {
      context.addIssue({
        code: 'custom',
        message: `L’application n’est pas conçue pour les moins de ${MIN_PLAUSIBLE_AGE_YEARS} ans.`,
      });
    }

    if (age > MAX_PLAUSIBLE_AGE_YEARS) {
      context.addIssue({ code: 'custom', message: 'Indique une date de naissance valide.' });
    }
  });
}

export const trainingDaysPerWeekSchema = z
  .number()
  .int({ error: 'Indique un nombre entier de jours.' })
  .min(0, { error: 'Le nombre de jours doit être compris entre 0 et 7.' })
  .max(7, { error: 'Le nombre de jours doit être compris entre 0 et 7.' });

// --- Schémas par écran -----------------------------------------------------

export const goalStepSchema = z.object({ goalType: goalTypeSchema });

export function buildBiometricsStepSchema(now: Date = new Date()) {
  return z.object({
    sex: sexSchema,
    birthDate: buildBirthDateSchema(now),
    heightCm: heightCmSchema,
    currentWeightKg: weightKgSchema,
  });
}

/**
 * Poids cible. Un objectif menant à l'insuffisance pondérale n'est **pas**
 * rejeté ici : le domaine lève `goal_leads_to_underweight` et l'UI avertit avec
 * bienveillance (PHASE_1 §5.4). Bloquer la saisie serait brutal et pousserait
 * l'utilisateur à mentir sur ses chiffres.
 */
export const targetWeightStepSchema = z.object({
  targetWeightKg: weightKgSchema.optional(),
});

export const activityStepSchema = z.object({ activityLevel: activityLevelSchema });

export const sportProfileSchema = z.object({
  practices: z.array(z.enum(['strength', 'cardio'])),
  strengthEnvironments: z.array(z.enum(['gym', 'home'])),
  cardioActivities: z.array(z.enum(['walking', 'running', 'cycling'])),
});

export const trainingStepSchema = z.object({
  trainingDaysPerWeek: trainingDaysPerWeekSchema,
  sportProfile: sportProfileSchema,
});

export const dietStepSchema = z.object({
  dietType: dietTypeSchema,
  allergies: z.array(z.string()),
  dislikes: z.array(z.string()),
});

/**
 * Rythme hebdomadaire visé.
 *
 * Le plafond n'est pas une constante d'écran : il vient de
 * `getMaxWeeklyRateKg`, donc du poids corporel et du garde-fou de la Phase 1.
 */
export function buildWeeklyRateStepSchema(currentWeightKg: number) {
  const maxWeeklyRateKg = getMaxWeeklyRateKg(currentWeightKg);

  return z.object({
    weeklyRateKg: z
      .number()
      .positive({ error: 'Choisis un rythme supérieur à zéro.' })
      .max(maxWeeklyRateKg, {
        error: `Pour ta santé, le rythme est plafonné à ${maxWeeklyRateKg.toFixed(2)} kg par semaine.`,
      }),
  });
}

export const calorieModeStepSchema = z.object({ calorieMode: calorieModeSchema });
