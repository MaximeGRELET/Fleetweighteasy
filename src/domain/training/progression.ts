import { InvalidInputError } from '@/domain/errors';

import type { Equipment, ExerciseSet, ProgramExercise } from './types';

/**
 * Double progression.
 *
 * La règle est simple et éprouvée (DONNEES_SPORT §B.6) : on vise une fourchette
 * de répétitions ; quand le haut de la fourchette est atteint **sur toutes les
 * séries**, on augmente la difficulté à la séance suivante, et on redescend en
 * bas de fourchette.
 *
 * « Sur toutes les séries » n'est pas un détail : réussir douze répétitions à la
 * première série puis huit aux suivantes n'est pas le signe qu'il faut charger
 * davantage, c'est le signe que la série de tête était trop facile.
 *
 * En salle, la difficulté augmente par la charge. À la maison, sans charge à
 * ajouter, elle augmente par les répétitions — la fourchette se décale vers le
 * haut, et le passage à une variante plus difficile relève du conseil, pas du
 * calcul.
 */

/**
 * Incrément de charge par défaut, en kilogrammes.
 *
 * 2,5 kg est le plus petit saut praticable avec des disques courants sur la
 * plupart des mouvements. Une valeur plus fine n'existe pas en salle, une plus
 * grossière ferait décrocher trop tôt.
 */
export const LOAD_INCREMENT_KG = 2.5;

/** Décalage de fourchette au poids du corps, faute de charge à ajouter. */
export const BODYWEIGHT_REP_INCREMENT = 2;

export type ProgressionAdvice = 'increase_load' | 'increase_reps' | 'hold';

export interface ProgressionTarget {
  sets: number;
  repRange: readonly [number, number];
  /** Charge visée, absente au poids du corps. */
  weightKg?: number;
  /** Clé de message, mise en mots par la couche UI. Le domaine ne rédige pas. */
  advice: ProgressionAdvice;
}

export interface ProgressionInput {
  /** Cible de la séance qui vient d'être réalisée. */
  planned: ProgramExercise;
  /** Séries effectivement réalisées. */
  performed: readonly ExerciseSet[];
  equipment: Equipment;
}

/**
 * Cible de la prochaine séance, d'après ce qui vient d'être réalisé.
 *
 * Fonction pure : mêmes performances, même cible. Rien n'est lu ni horodaté.
 */
export function nextProgressionTarget(input: ProgressionInput): ProgressionTarget {
  const [minReps, maxReps] = input.planned.repRange;

  assertUsableRange(minReps, maxReps);

  const currentWeightKg = heaviestSetWeightKg(input.performed);
  const holding: ProgressionTarget = {
    sets: input.planned.sets,
    repRange: input.planned.repRange,
    ...(currentWeightKg === undefined ? {} : { weightKg: currentWeightKg }),
    advice: 'hold',
  };

  if (!hasClearedRange(input.performed, input.planned.sets, maxReps)) {
    return holding;
  }

  if (input.equipment === 'gym') {
    return {
      sets: input.planned.sets,
      repRange: input.planned.repRange,
      // Sans charge relevée, on ne peut pas en proposer une : la progression
      // se fait alors en répétitions, comme au poids du corps.
      ...(currentWeightKg === undefined
        ? {}
        : { weightKg: roundToHalf(currentWeightKg + LOAD_INCREMENT_KG) }),
      advice: currentWeightKg === undefined ? 'increase_reps' : 'increase_load',
    };
  }

  return {
    sets: input.planned.sets,
    repRange: [minReps + BODYWEIGHT_REP_INCREMENT, maxReps + BODYWEIGHT_REP_INCREMENT],
    advice: 'increase_reps',
  };
}

/**
 * Vrai si toutes les séries prévues ont atteint le haut de la fourchette.
 *
 * Une série manquante compte comme non réussie : on ne progresse pas sur un
 * volume qu'on n'a pas fait.
 */
export function hasClearedRange(
  performed: readonly ExerciseSet[],
  plannedSets: number,
  maxReps: number,
): boolean {
  if (performed.length < plannedSets) {
    return false;
  }

  return performed.slice(0, plannedSets).every((set) => set.reps >= maxReps);
}

/**
 * Charge de référence : la plus lourde des séries réalisées.
 *
 * Prendre la plus lourde plutôt que la dernière évite qu'une série de finition
 * allégée fasse reculer la cible.
 */
function heaviestSetWeightKg(performed: readonly ExerciseSet[]): number | undefined {
  const weights = performed
    .map((set) => set.weightKg)
    .filter((weight): weight is number => weight !== undefined);

  return weights.length > 0 ? Math.max(...weights) : undefined;
}

/** Arrondi au demi-kilo : la précision des disques les plus fins. */
function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function assertUsableRange(minReps: number, maxReps: number): void {
  if (!Number.isFinite(minReps) || !Number.isFinite(maxReps) || minReps < 1 || maxReps < minReps) {
    throw new InvalidInputError(
      'repRange',
      `Fourchette de répétitions invalide : [${minReps}, ${maxReps}].`,
    );
  }
}
