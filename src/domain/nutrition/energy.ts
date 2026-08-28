import { getAge } from '@/domain/profile/age';
import {
  assertPlausibleAge,
  assertPlausibleHeight,
  assertPlausibleWeight,
} from '@/domain/profile/bmi';
import type { ActivityLevel, Sex, UserProfile } from '@/domain/profile/types';
import {
  assertUsableWeeklyRate,
  checkTargetWeightSafety,
  getDefaultWeeklyRateKg,
  getMaxWeeklyRateKg,
  getMinimumDailyKcal,
  KCAL_PER_KG_FAT,
  MAX_DAILY_DEFICIT_KCAL,
  type SafetyAdjustment,
  type SafetyWarning,
} from './safety';

/**
 * Métabolisme, dépense totale et objectif calorique.
 *
 * Fonctions pures : mêmes entrées, mêmes sorties, aucune mutation des entrées,
 * aucune I/O. Toute valeur de référence est une constante nommée et sourcée.
 */

// --- Métabolisme de base (BMR) --------------------------------------------

/**
 * Constantes de l'équation de Mifflin-St Jeor (1990), retenue pour sa précision
 * reconnue sur la population générale.
 *
 *   Homme : 10 × poidsKg + 6.25 × tailleCm − 5 × âge + 5
 *   Femme : 10 × poidsKg + 6.25 × tailleCm − 5 × âge − 161
 */
const MIFFLIN_WEIGHT_COEFFICIENT = 10;
const MIFFLIN_HEIGHT_COEFFICIENT = 6.25;
const MIFFLIN_AGE_COEFFICIENT = 5;
const MIFFLIN_CONSTANT_MALE = 5;
const MIFFLIN_CONSTANT_FEMALE = -161;

export function calculateBmr(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): number {
  assertPlausibleWeight(input.weightKg);
  assertPlausibleHeight(input.heightCm);
  assertPlausibleAge(input.ageYears);

  const sexConstant = input.sex === 'male' ? MIFFLIN_CONSTANT_MALE : MIFFLIN_CONSTANT_FEMALE;

  // Les bornes physiologiques vérifiées ci-dessus garantissent un BMR positif :
  // le minimum atteignable (femme, 25 kg, 100 cm, 120 ans) reste > 0.
  const bmr =
    MIFFLIN_WEIGHT_COEFFICIENT * input.weightKg +
    MIFFLIN_HEIGHT_COEFFICIENT * input.heightCm -
    MIFFLIN_AGE_COEFFICIENT * input.ageYears +
    sexConstant;

  return Math.round(bmr);
}

// --- Dépense énergétique totale (TDEE) -------------------------------------

/**
 * Facteurs d'activité de référence.
 *
 * Ils intègrent déjà l'activité physique habituelle, entraînement régulier
 * compris. C'est le fondement du mode `fixed` : le sport ponctuel n'a pas à être
 * re-crédité puisqu'il est déjà pris en compte ici.
 */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);
}

// --- Objectif calorique ----------------------------------------------------

/**
 * Déficit appliqué en recomposition.
 *
 * La spécification prévoit un objectif proche du maintien, avec un déficit léger
 * optionnel de 0 à 200 kcal (PHASE_1 §5.2). On retient 200 kcal : la
 * recomposition vise une perte de gras lente à masse maigre préservée, portée
 * surtout par les protéines et l'entraînement en résistance.
 */
export const RECOMPOSITION_DEFICIT_KCAL = 200;

export interface CalorieTargetResult {
  targetKcal: number;
  tdeeKcal: number;
  bmrKcal: number;
  /** Déficit réellement appliqué (TDEE − objectif). Négatif si le plancher a créé un surplus. */
  appliedDeficitKcal: number;
  /** Rythme réel après application des bornes, en kg/semaine. */
  effectiveWeeklyRateKg: number;
  adjustments: SafetyAdjustment[];
  warnings: SafetyWarning[];
}

/**
 * Calcule l'objectif calorique quotidien en appliquant tous les garde-fous.
 *
 * Aucun chemin de ce calcul ne peut produire un objectif sous le plancher
 * calorique : le plancher est appliqué en dernier, quel que soit le `goalType`.
 *
 * @param now instant de référence, injecté pour garder la fonction pure
 */
export function calculateCalorieTarget(
  profile: UserProfile,
  now: Date = new Date(),
): CalorieTargetResult {
  const ageYears = getAge(profile.birthDate, now);
  const bmrKcal = calculateBmr({
    sex: profile.sex,
    weightKg: profile.currentWeightKg,
    heightCm: profile.heightCm,
    ageYears,
  });
  const tdeeKcal = calculateTdee(bmrKcal, profile.activityLevel);

  const adjustments: SafetyAdjustment[] = [];
  const warnings: SafetyWarning[] = [...checkTargetWeightSafety(profile)];

  const desiredDeficitKcal = resolveDesiredDeficit(profile, adjustments, warnings);
  const rawTargetKcal = Math.round(tdeeKcal - desiredDeficitKcal);

  // Plancher calorique : dernier rempart, appliqué quel que soit l'objectif.
  const floorKcal = getMinimumDailyKcal(profile.sex);
  let targetKcal = rawTargetKcal;

  if (targetKcal < floorKcal) {
    targetKcal = floorKcal;
    adjustments.push('floor_applied');
    warnings.push('target_below_healthy_floor');
  }

  const appliedDeficitKcal = tdeeKcal - targetKcal;

  return {
    targetKcal,
    tdeeKcal,
    bmrKcal,
    appliedDeficitKcal,
    effectiveWeeklyRateKg: deficitToWeeklyRateKg(appliedDeficitKcal),
    adjustments,
    warnings,
  };
}

/**
 * Déficit souhaité avant application du plancher, selon l'objectif de l'utilisateur.
 * Enrichit `adjustments` et `warnings` au passage (aucun ajustement silencieux).
 */
function resolveDesiredDeficit(
  profile: UserProfile,
  adjustments: SafetyAdjustment[],
  warnings: SafetyWarning[],
): number {
  switch (profile.goalType) {
    case 'maintenance':
      return 0;

    case 'recomposition':
      return RECOMPOSITION_DEFICIT_KCAL;

    case 'weight_loss': {
      const maxWeeklyRateKg = getMaxWeeklyRateKg(profile.currentWeightKg);

      let weeklyRateKg: number;
      if (profile.weeklyRateKg === undefined) {
        weeklyRateKg = getDefaultWeeklyRateKg(profile.currentWeightKg);
      } else {
        assertUsableWeeklyRate(profile.weeklyRateKg);
        weeklyRateKg = profile.weeklyRateKg;

        if (weeklyRateKg > maxWeeklyRateKg) {
          warnings.push('aggressive_rate_requested');
        }
      }

      if (weeklyRateKg > maxWeeklyRateKg) {
        weeklyRateKg = maxWeeklyRateKg;
        adjustments.push('rate_capped');
      }

      const deficitKcal = weeklyRateToDeficitKcal(weeklyRateKg);

      if (deficitKcal > MAX_DAILY_DEFICIT_KCAL) {
        adjustments.push('deficit_capped');
        return MAX_DAILY_DEFICIT_KCAL;
      }

      return deficitKcal;
    }
  }
}

const DAYS_PER_WEEK = 7;

/** Traduit un rythme hebdomadaire (kg/semaine) en déficit quotidien (kcal/jour). */
export function weeklyRateToDeficitKcal(weeklyRateKg: number): number {
  return (weeklyRateKg * KCAL_PER_KG_FAT) / DAYS_PER_WEEK;
}

/** Traduit un déficit quotidien (kcal/jour) en rythme hebdomadaire (kg/semaine). */
export function deficitToWeeklyRateKg(dailyDeficitKcal: number): number {
  const rate = (dailyDeficitKcal * DAYS_PER_WEEK) / KCAL_PER_KG_FAT;
  return Math.round(rate * 1000) / 1000;
}

// --- Recalcul adaptatif ----------------------------------------------------

/**
 * Écart minimal d'objectif justifiant de prévenir l'utilisateur.
 * En dessous, on évite les micro-ajustements anxiogènes (PHASE_1 §8).
 */
export const ADAPTIVE_NOTIFY_THRESHOLD_KCAL = 50;

export interface AdaptiveRecalculationResult {
  previous: CalorieTargetResult;
  next: CalorieTargetResult;
  weightDeltaKg: number;
  targetDeltaKcal: number;
  /** Vrai si l'écart est significatif ou si un nouveau garde-fou s'est déclenché. */
  shouldNotifyUser: boolean;
}

/**
 * Recalcule BMR / TDEE / objectif à partir d'un nouveau poids.
 *
 * Ne mute pas le profil reçu : renvoie les deux jeux de valeurs pour que l'UI
 * puisse expliquer l'ajustement plutôt que de changer les chiffres en silence.
 */
export function recalculateForNewWeight(input: {
  profile: UserProfile;
  newWeightKg: number;
  now?: Date;
}): AdaptiveRecalculationResult {
  const now = input.now ?? new Date();
  assertPlausibleWeight(input.newWeightKg);

  const previous = calculateCalorieTarget(input.profile, now);
  const updatedProfile: UserProfile = { ...input.profile, currentWeightKg: input.newWeightKg };
  const next = calculateCalorieTarget(updatedProfile, now);

  const targetDeltaKcal = next.targetKcal - previous.targetKcal;
  const newSafetyEvent =
    hasNewEntry(previous.adjustments, next.adjustments) ||
    hasNewEntry(previous.warnings, next.warnings);

  return {
    previous,
    next,
    weightDeltaKg: Math.round((input.newWeightKg - input.profile.currentWeightKg) * 100) / 100,
    targetDeltaKcal,
    shouldNotifyUser: Math.abs(targetDeltaKcal) >= ADAPTIVE_NOTIFY_THRESHOLD_KCAL || newSafetyEvent,
  };
}

function hasNewEntry<T>(before: readonly T[], after: readonly T[]): boolean {
  return after.some((entry) => !before.includes(entry));
}
