import { InvalidBiometricsError } from '@/domain/errors';

/**
 * Seuils d'IMC de l'OMS.
 * `BMI_UNDERWEIGHT_THRESHOLD` est le garde-fou utilisé pour refuser
 * d'encourager un poids cible menant à l'insuffisance pondérale
 * (PHASE_1_DOMAINE_NUTRITIONNEL §5.1 et §5.4).
 */
export const BMI_UNDERWEIGHT_THRESHOLD = 18.5;
export const BMI_OVERWEIGHT_THRESHOLD = 25;
export const BMI_OBESITY_THRESHOLD = 30;

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obesity';

/** IMC = poids (kg) / taille (m)². Arrondi au dixième. */
export function calculateBmi(input: { weightKg: number; heightCm: number }): number {
  assertPlausibleWeight(input.weightKg);
  assertPlausibleHeight(input.heightCm);

  const heightM = input.heightCm / 100;
  return roundTo(input.weightKg / (heightM * heightM), 1);
}

export function classifyBmi(bmi: number): BmiCategory {
  if (bmi < BMI_UNDERWEIGHT_THRESHOLD) return 'underweight';
  if (bmi < BMI_OVERWEIGHT_THRESHOLD) return 'normal';
  if (bmi < BMI_OBESITY_THRESHOLD) return 'overweight';
  return 'obesity';
}

/**
 * Poids (kg) correspondant à l'IMC plancher de santé pour une taille donnée.
 * Sert à proposer une alternative sûre quand un poids cible est trop bas.
 */
export function minimumHealthyWeightKg(heightCm: number): number {
  assertPlausibleHeight(heightCm);
  const heightM = heightCm / 100;
  return roundTo(BMI_UNDERWEIGHT_THRESHOLD * heightM * heightM, 1);
}

// --- Plages physiologiques plausibles -------------------------------------
// Volontairement larges : il s'agit d'arrêter les saisies absurdes ou les bugs
// d'unité (grammes saisis en kilos), pas de juger la morphologie d'un utilisateur.
export const MIN_PLAUSIBLE_WEIGHT_KG = 25;
export const MAX_PLAUSIBLE_WEIGHT_KG = 400;
export const MIN_PLAUSIBLE_HEIGHT_CM = 100;
export const MAX_PLAUSIBLE_HEIGHT_CM = 250;
export const MIN_PLAUSIBLE_AGE_YEARS = 13;
export const MAX_PLAUSIBLE_AGE_YEARS = 120;

export function assertPlausibleWeight(weightKg: number): void {
  assertFinite('weightKg', weightKg);
  if (weightKg < MIN_PLAUSIBLE_WEIGHT_KG || weightKg > MAX_PLAUSIBLE_WEIGHT_KG) {
    throw new InvalidBiometricsError(
      'weightKg',
      `Poids hors plage plausible (${MIN_PLAUSIBLE_WEIGHT_KG}–${MAX_PLAUSIBLE_WEIGHT_KG} kg) : ${weightKg}.`,
    );
  }
}

export function assertPlausibleHeight(heightCm: number): void {
  assertFinite('heightCm', heightCm);
  if (heightCm < MIN_PLAUSIBLE_HEIGHT_CM || heightCm > MAX_PLAUSIBLE_HEIGHT_CM) {
    throw new InvalidBiometricsError(
      'heightCm',
      `Taille hors plage plausible (${MIN_PLAUSIBLE_HEIGHT_CM}–${MAX_PLAUSIBLE_HEIGHT_CM} cm) : ${heightCm}.`,
    );
  }
}

export function assertPlausibleAge(ageYears: number): void {
  assertFinite('ageYears', ageYears);
  if (ageYears < MIN_PLAUSIBLE_AGE_YEARS || ageYears > MAX_PLAUSIBLE_AGE_YEARS) {
    throw new InvalidBiometricsError(
      'ageYears',
      `Âge hors plage plausible (${MIN_PLAUSIBLE_AGE_YEARS}–${MAX_PLAUSIBLE_AGE_YEARS} ans) : ${ageYears}.`,
    );
  }
}

function assertFinite(field: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new InvalidBiometricsError(field, `Valeur numérique invalide pour ${field}.`);
  }
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
