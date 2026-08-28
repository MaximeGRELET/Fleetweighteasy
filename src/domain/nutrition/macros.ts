import { InvalidInputError } from '@/domain/errors';
import { assertPlausibleWeight } from '@/domain/profile/bmi';
import type { GoalType } from '@/domain/profile/types';

/**
 * Répartition des macronutriments.
 *
 * Ordre de calcul : protéines (par g/kg) → lipides (plancher puis ajustement)
 * → glucides (le reste). Aucun macro ne peut être négatif, et le plancher
 * lipidique santé n'est franchi qu'en dernier recours, toujours signalé.
 */

// --- Densités énergétiques (Atwater) ---------------------------------------
export const KCAL_PER_G_PROTEIN = 4;
export const KCAL_PER_G_CARBS = 4;
export const KCAL_PER_G_FAT = 9;

// --- Cibles protéiques -----------------------------------------------------
/**
 * Apport protéique cible, en g/kg de poids corporel.
 *
 * Source : littérature sur la préservation de la masse maigre en déficit
 * (apport protéique élevé + entraînement en résistance), fourchette 1.6–2.2 g/kg.
 * Défauts retenus : 1.8 g/kg en perte de poids, 2.0 g/kg en recomposition,
 * 1.6 g/kg au maintien (bas de fourchette, besoin de préservation moindre).
 */
export const PROTEIN_G_PER_KG: Record<GoalType, number> = {
  weight_loss: 1.8,
  recomposition: 2.0,
  maintenance: 1.6,
};

/**
 * Plancher protéique absolu, utilisé uniquement quand l'objectif calorique ne
 * permet pas d'atteindre la cible ci-dessus.
 */
export const MIN_PROTEIN_G_PER_KG = 1.2;

// --- Lipides ---------------------------------------------------------------
/**
 * Plancher lipidique santé, en g/kg de poids corporel.
 * Rôle hormonal et absorption des vitamines liposolubles : on ne descend pas
 * sous ce seuil (PHASE_1 §6.1).
 */
export const MIN_FAT_G_PER_KG = 0.8;

/**
 * Part de l'énergie allouée aux lipides au-delà du plancher, quand le budget
 * calorique le permet. 28 % est au centre des recommandations usuelles (20–35 %).
 */
export const FAT_ENERGY_SHARE = 0.28;

export type MacroAdjustment =
  /** Les protéines ont été réduites sous leur cible faute de calories disponibles. */
  | 'protein_reduced'
  /** Cas extrême : les planchers eux-mêmes ne tiennent pas dans l'objectif calorique. */
  | 'macro_floors_unreachable';

export interface MacroResult {
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** Énergie réellement représentée par les macros arrondis (≈ targetKcal). */
  energyKcal: number;
  adjustments: MacroAdjustment[];
}

export function calculateMacros(input: {
  targetKcal: number;
  weightKg: number;
  goalType: GoalType;
}): MacroResult {
  assertPlausibleWeight(input.weightKg);

  if (!Number.isFinite(input.targetKcal) || input.targetKcal <= 0) {
    throw new InvalidInputError(
      'targetKcal',
      `L'objectif calorique doit être strictement positif : ${input.targetKcal}.`,
    );
  }

  const { targetKcal, weightKg, goalType } = input;

  const proteinFloorG = weightKg * MIN_PROTEIN_G_PER_KG;
  const fatFloorG = weightKg * MIN_FAT_G_PER_KG;
  const floorsKcal = proteinFloorG * KCAL_PER_G_PROTEIN + fatFloorG * KCAL_PER_G_FAT;

  // Cas extrême : l'objectif calorique ne couvre même pas les deux planchers.
  // On les ramène proportionnellement plutôt que de produire un macro négatif,
  // et on le signale pour que l'UI puisse alerter.
  if (targetKcal < floorsKcal) {
    const scale = targetKcal / floorsKcal;
    return buildResult({
      proteinG: proteinFloorG * scale,
      fatG: fatFloorG * scale,
      targetKcal,
      adjustments: ['macro_floors_unreachable'],
    });
  }

  const adjustments: MacroAdjustment[] = [];

  // 1. Protéines : cible par g/kg, réduite si le budget ne la permet pas.
  //    Le plancher lipidique reste prioritaire sur la cible protéique.
  const affordableProteinG = (targetKcal - fatFloorG * KCAL_PER_G_FAT) / KCAL_PER_G_PROTEIN;
  let proteinG = weightKg * PROTEIN_G_PER_KG[goalType];

  if (proteinG > affordableProteinG) {
    proteinG = affordableProteinG;
    adjustments.push('protein_reduced');
  }

  // 2. Lipides : plancher santé, relevé vers la part énergétique cible dès que
  //    le budget calorique le permet.
  const fatG = Math.max(fatFloorG, (targetKcal * FAT_ENERGY_SHARE) / KCAL_PER_G_FAT);

  // 3. Glucides : le reste. Positif par construction — voir les tests de balayage.
  return buildResult({ proteinG, fatG, targetKcal, adjustments });
}

function buildResult(input: {
  proteinG: number;
  fatG: number;
  targetKcal: number;
  adjustments: MacroAdjustment[];
}): MacroResult {
  const proteinG = Math.round(input.proteinG);
  const fatG = Math.round(input.fatG);
  const remainingKcal = input.targetKcal - proteinG * KCAL_PER_G_PROTEIN - fatG * KCAL_PER_G_FAT;
  const carbsG = Math.max(0, Math.round(remainingKcal / KCAL_PER_G_CARBS));

  return {
    proteinG,
    fatG,
    carbsG,
    energyKcal: macroEnergyKcal({ proteinG, fatG, carbsG }),
    adjustments: input.adjustments,
  };
}

/** Énergie (kcal) correspondant à une répartition de macros. */
export function macroEnergyKcal(macros: {
  proteinG: number;
  fatG: number;
  carbsG: number;
}): number {
  return Math.round(
    macros.proteinG * KCAL_PER_G_PROTEIN +
      macros.fatG * KCAL_PER_G_FAT +
      macros.carbsG * KCAL_PER_G_CARBS,
  );
}
