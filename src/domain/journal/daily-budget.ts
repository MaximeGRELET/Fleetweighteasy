import { buildDualCalorieView, type ExplanationKey } from '@/domain/nutrition/calories-sport';
import type { MacroResult } from '@/domain/nutrition/macros';
import type { CalorieMode } from '@/domain/profile/types';

import type { DailyTotals } from './types';

/**
 * Tableau du jour : ce qui reste à manger, et pourquoi ce chiffre.
 *
 * Fonction pure, comme tout le domaine. Elle ne lit rien et ne stocke rien :
 * l'objectif vient du profil, le consommé de la somme des snapshots, la dépense
 * sportive du journal des séances. L'UI n'assemble jamais ces trois-là
 * elle-même — sinon la règle du `calorieMode` finirait dupliquée dans chaque
 * écran qui affiche un budget.
 *
 * Les **deux** vues (avec et sans crédit sportif) sont toujours calculées, même
 * quand une seule est affichée : la transparence exigée par PHASE_1 §7.2 veut
 * que l'utilisateur puisse voir ce que l'autre mode donnerait, sans que l'app
 * ait à recalculer quoi que ce soit au moment où il le demande.
 */

export interface BudgetView {
  mode: CalorieMode;
  /** Calories disponibles sur la journée dans ce mode. */
  budgetKcal: number;
  /** Budget − consommé. **Signé** : négatif au-delà du budget. */
  remainingKcal: number;
  /** Vrai si le consommé dépasse le budget. Un constat, pas une alarme. */
  overBudget: boolean;
  /** Clé d'explication du mode, traduite par la couche UI. */
  explanation: ExplanationKey;
}

/** Avancement d'un macronutriment sur la journée. */
export interface MacroProgress {
  consumedG: number;
  targetG: number;
  /** Cible − consommé. Signé, comme les calories. */
  remainingG: number;
  /**
   * Part de la cible atteinte, non bornée : au-delà de 1, l'utilisateur a
   * dépassé. C'est l'UI qui décide de tronquer la barre, pas le domaine.
   */
  ratio: number;
}

export interface DailyBudget {
  consumedKcal: number;
  /** Dépense sportive estimée du jour. Toujours affichée, même en mode `fixed`. */
  exerciseKcal: number;
  /** Vue correspondant au mode réglé dans le profil. */
  active: BudgetView;
  /** L'autre vue, accessible par transparence. */
  alternative: BudgetView;
  protein: MacroProgress;
  carbs: MacroProgress;
  fat: MacroProgress;
  fiberG: number;
}

export interface DailyBudgetInput {
  mode: CalorieMode;
  /** Objectif calorique du profil, avant crédit sportif éventuel. */
  targetKcal: number;
  /** Cibles de macros, dérivées de l'objectif. */
  macros: MacroResult;
  /** Somme des snapshots du jour. */
  consumed: DailyTotals;
  /** Dépense cardio estimée du jour. Indicative, souvent surestimée. */
  exerciseKcal: number;
}

export function buildDailyBudget(input: DailyBudgetInput): DailyBudget {
  const views = buildDualCalorieView({
    mode: input.mode,
    targetKcal: input.targetKcal,
    exerciseKcal: input.exerciseKcal,
  });

  const consumedKcal = input.consumed.kcal;
  const isCredited = input.mode === 'credited';

  return {
    consumedKcal,
    exerciseKcal: input.exerciseKcal,
    active: toBudgetView(isCredited ? 'credited' : 'fixed', views.active, consumedKcal),
    // L'alternative est l'autre mode, quel que soit celui qui est réglé : c'est
    // ce qui rend le bouton « et si je créditais le sport ? » symétrique.
    alternative: toBudgetView(
      isCredited ? 'fixed' : 'credited',
      isCredited ? views.fixed : views.credited,
      consumedKcal,
    ),
    protein: toMacroProgress(input.consumed.proteinG, input.macros.proteinG),
    carbs: toMacroProgress(input.consumed.carbsG, input.macros.carbsG),
    fat: toMacroProgress(input.consumed.fatG, input.macros.fatG),
    fiberG: input.consumed.fiberG,
  };
}

function toBudgetView(
  mode: CalorieMode,
  view: { effectiveBudgetKcal: number; explanation: ExplanationKey },
  consumedKcal: number,
): BudgetView {
  const remainingKcal = view.effectiveBudgetKcal - consumedKcal;

  return {
    mode,
    budgetKcal: view.effectiveBudgetKcal,
    remainingKcal,
    overBudget: remainingKcal < 0,
    explanation: view.explanation,
  };
}

/** Arrondi au dixième : au-delà, on afficherait une fausse précision. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function toMacroProgress(consumedG: number, targetG: number): MacroProgress {
  return {
    consumedG,
    targetG,
    remainingG: round1(targetG - consumedG),
    // Une cible nulle n'existe pas dans les faits (les planchers de macros
    // l'interdisent), mais une division par zéro produirait un `Infinity` qui
    // se propagerait jusqu'à une largeur de barre invalide.
    ratio: targetG > 0 ? consumedG / targetG : 0,
  };
}
