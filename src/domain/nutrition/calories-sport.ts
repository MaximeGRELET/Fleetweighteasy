import { InvalidInputError } from '@/domain/errors';
import { assertPlausibleWeight } from '@/domain/profile/bmi';
import type { CalorieMode } from '@/domain/profile/types';

import { findMetEntry } from './mets-table';

/**
 * Dépense sportive estimée et gestion des deux modes de calories.
 *
 * Les estimations METs sont indicatives et tendent à surestimer la dépense
 * réelle : c'est précisément la justification du mode par défaut `fixed`.
 */

const MINUTES_PER_HOUR = 60;

/** Bornes de plausibilité, pour arrêter les saisies aberrantes. */
export const MAX_SESSION_DURATION_MIN = 24 * MINUTES_PER_HOUR;
export const MIN_MET_VALUE = 1;
export const MAX_MET_VALUE = 25;

/** kcal = MET × poidsKg × duréeHeures. */
export function estimateCardioKcal(input: {
  metValue: number;
  weightKg: number;
  durationMin: number;
}): number {
  assertPlausibleWeight(input.weightKg);
  assertUsableMet(input.metValue);
  assertUsableDuration(input.durationMin);

  return Math.round(input.metValue * input.weightKg * (input.durationMin / MINUTES_PER_HOUR));
}

/** Variante qui résout le MET depuis la table de référence. */
export function estimateCardioKcalFromEntry(input: {
  metEntryId: string;
  weightKg: number;
  durationMin: number;
}): number {
  const entry = findMetEntry(input.metEntryId);

  if (!entry) {
    throw new InvalidInputError(
      'metEntryId',
      `Activité cardio inconnue dans la table METs : « ${input.metEntryId} ».`,
    );
  }

  return estimateCardioKcal({
    metValue: entry.met,
    weightKg: input.weightKg,
    durationMin: input.durationMin,
  });
}

/** Clé de message, traduite par la couche UI. Le domaine ne rédige pas de texte. */
export type ExplanationKey = 'fixed_mode' | 'credited_mode';

export interface CalorieModeResult {
  effectiveBudgetKcal: number;
  explanation: ExplanationKey;
}

/**
 * Applique le mode de gestion des calories sport.
 *
 * - `fixed` (défaut) : le budget ne bouge pas. Le sport est enregistré et
 *   affiché, mais n'augmente pas les calories disponibles — le facteur
 *   d'activité du TDEE l'intègre déjà.
 * - `credited` : la dépense estimée s'ajoute au budget du jour.
 */
export function applyCalorieMode(input: {
  mode: CalorieMode;
  targetKcal: number;
  exerciseKcal: number;
}): CalorieModeResult {
  assertUsableEnergy('targetKcal', input.targetKcal);
  assertUsableEnergy('exerciseKcal', input.exerciseKcal);

  if (input.mode === 'credited') {
    return {
      effectiveBudgetKcal: input.targetKcal + input.exerciseKcal,
      explanation: 'credited_mode',
    };
  }

  return { effectiveBudgetKcal: input.targetKcal, explanation: 'fixed_mode' };
}

export interface DualCalorieView {
  fixed: CalorieModeResult;
  credited: CalorieModeResult;
  active: CalorieModeResult;
}

/**
 * Les deux vues restent calculables simultanément : l'UI affiche le budget
 * effectif et ce qu'il serait dans l'autre mode, par transparence (PHASE_1 §7.2).
 */
export function buildDualCalorieView(input: {
  mode: CalorieMode;
  targetKcal: number;
  exerciseKcal: number;
}): DualCalorieView {
  const fixed = applyCalorieMode({ ...input, mode: 'fixed' });
  const credited = applyCalorieMode({ ...input, mode: 'credited' });

  return { fixed, credited, active: input.mode === 'credited' ? credited : fixed };
}

function assertUsableMet(metValue: number): void {
  if (!Number.isFinite(metValue) || metValue < MIN_MET_VALUE || metValue > MAX_MET_VALUE) {
    throw new InvalidInputError(
      'metValue',
      `Valeur MET hors plage plausible (${MIN_MET_VALUE}–${MAX_MET_VALUE}) : ${metValue}.`,
    );
  }
}

function assertUsableDuration(durationMin: number): void {
  if (!Number.isFinite(durationMin) || durationMin < 0 || durationMin > MAX_SESSION_DURATION_MIN) {
    throw new InvalidInputError(
      'durationMin',
      `Durée hors plage plausible (0–${MAX_SESSION_DURATION_MIN} min) : ${durationMin}.`,
    );
  }
}

function assertUsableEnergy(field: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new InvalidInputError(field, `${field} doit être un nombre positif ou nul : ${value}.`);
  }
}
