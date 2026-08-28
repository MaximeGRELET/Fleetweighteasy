import { InvalidInputError } from '@/domain/errors';
import {
  BMI_UNDERWEIGHT_THRESHOLD,
  calculateBmi,
  minimumHealthyWeightKg,
} from '@/domain/profile/bmi';
import type { Sex, UserProfile } from '@/domain/profile/types';

/**
 * GARDE-FOUS DE SÉCURITÉ — partie la plus sensible de l'application.
 *
 * Toutes les valeurs ci-dessous sont des constantes nommées et sourcées : aucun
 * nombre magique n'est inséré directement dans une formule. Elles s'appliquent
 * **avant** tout affichage à l'utilisateur et ne peuvent jamais être contournées
 * par une couche supérieure.
 *
 * Ces seuils devront être revalidés par un professionnel de santé avant mise en
 * production (PHASE_1_DOMAINE_NUTRITIONNEL §12).
 */

// --- Planchers caloriques --------------------------------------------------
/**
 * Planchers caloriques absolus, hors supervision médicale.
 * Source : guidelines cliniques obésité (protocoles reprenant les 2013 Obesity
 * Guidelines) — minimum prescrit 1200 kcal/j (femmes), 1500 kcal/j (hommes).
 * En dessous = diète très basses calories (VLCD), réservée au cadre médical.
 */
export const MIN_DAILY_KCAL_FEMALE = 1200;
export const MIN_DAILY_KCAL_MALE = 1500;

// --- Déficit ---------------------------------------------------------------
/**
 * Déficit quotidien maximal.
 * Source : Harvard Health (500–750 kcal/j) et consensus clinique (300–500 kcal/j
 * pour un déficit modéré préservant la masse maigre).
 */
export const MAX_DAILY_DEFICIT_KCAL = 750;

// --- Rythme de perte -------------------------------------------------------
/**
 * Plafond de rythme hebdomadaire, en fraction du poids corporel.
 * Source : littérature composition corporelle (Murphy & Koehler 2021 ; études
 * athlètes) — au-delà de ~1 %/semaine, la perte de masse maigre s'accélère
 * nettement. 0,5–1 %/semaine est la fourchette recommandée.
 */
export const MAX_WEEKLY_RATE_FRACTION = 0.01;

/** 0,75 %/semaine : compromis retenu par défaut entre perte de gras et maintien musculaire. */
export const DEFAULT_WEEKLY_RATE_FRACTION = 0.0075;

// --- Équivalence énergétique -----------------------------------------------
/** 1 kg de masse grasse ≈ 7700 kcal. */
export const KCAL_PER_KG_FAT = 7700;

/** Réexporté ici pour que tous les seuils de sécurité soient lisibles au même endroit. */
export { BMI_UNDERWEIGHT_THRESHOLD };

// --- Types de sortie -------------------------------------------------------

/** Un garde-fou qui a modifié le calcul. Jamais silencieux : toujours expliqué en UI. */
export type SafetyAdjustment = 'rate_capped' | 'deficit_capped' | 'floor_applied';

/** Un signal à remonter à l'utilisateur, sans forcément modifier le calcul. */
export type SafetyWarning =
  'target_below_healthy_floor' | 'goal_leads_to_underweight' | 'aggressive_rate_requested';

/** Plancher calorique applicable, selon le sexe biologique. */
export function getMinimumDailyKcal(sex: Sex): number {
  return sex === 'female' ? MIN_DAILY_KCAL_FEMALE : MIN_DAILY_KCAL_MALE;
}

/** Rythme hebdomadaire maximal autorisé (kg/semaine) pour un poids donné. */
export function getMaxWeeklyRateKg(currentWeightKg: number): number {
  return currentWeightKg * MAX_WEEKLY_RATE_FRACTION;
}

/** Rythme hebdomadaire proposé par défaut (kg/semaine) pour un poids donné. */
export function getDefaultWeeklyRateKg(currentWeightKg: number): number {
  return currentWeightKg * DEFAULT_WEEKLY_RATE_FRACTION;
}

/**
 * Garde-fou sur le poids cible (PHASE_1 §5.4).
 *
 * Le moteur signale, il ne bloque pas brutalement : la couche UI ne devra pas
 * encourager l'objectif, mais afficher un message bienveillant et orienter vers
 * un professionnel de santé.
 */
export function checkTargetWeightSafety(profile: UserProfile): SafetyWarning[] {
  const { targetWeightKg, heightCm } = profile;

  if (targetWeightKg === undefined) {
    return [];
  }

  const targetBmi = calculateBmi({ weightKg: targetWeightKg, heightCm });

  return targetBmi < BMI_UNDERWEIGHT_THRESHOLD ? ['goal_leads_to_underweight'] : [];
}

/** Poids minimal sain (kg) à proposer en alternative à un poids cible trop bas. */
export function suggestMinimumHealthyTargetWeightKg(heightCm: number): number {
  return minimumHealthyWeightKg(heightCm);
}

// --- Détection de signaux à risque (PHASE_1 §5.5) --------------------------

/**
 * Un objectif défini par l'utilisateur à un instant donné.
 *
 * L'historique est fourni par les phases ultérieures (persistance) ; la logique
 * de détection, elle, vit ici et reste pure.
 */
export interface GoalChangeEvent {
  /** Horodatage ISO 8601. */
  at: string;
  sex: Sex;
  currentWeightKg: number;
  heightCm: number;
  targetWeightKg?: number;
  /** Rythme demandé par l'utilisateur, avant plafonnement. */
  requestedWeeklyRateKg?: number;
  /** Objectif calorique explicitement demandé, avant application du plancher. */
  requestedDailyKcal?: number;
}

export type RiskSignal =
  | 'repeated_sub_floor_targets'
  | 'repeatedly_lowered_target_weight'
  | 'persistent_maximum_rate'
  | 'underweight_target_requested';

/**
 * Seuils de déclenchement des signaux.
 *
 * Volontairement bas : la conséquence d'un signal est un message bienveillant et
 * des ressources d'aide, jamais un blocage ni un renforcement de l'objectif. En
 * cas de doute, l'option la plus sûre pour l'utilisateur est de signaler.
 */
export const RISK_SUB_FLOOR_OCCURRENCES = 2;
export const RISK_TARGET_WEIGHT_DECREASES = 2;
export const RISK_MAX_RATE_OCCURRENCES = 3;

/** Un rythme à 90 % ou plus du plafond est considéré comme poussé au maximum. */
export const RISK_MAX_RATE_TOLERANCE = 0.9;

/**
 * Détecte des schémas préoccupants dans l'historique des objectifs.
 *
 * Ne pose aucun diagnostic : signale des motifs qui déclencheront, en UI, un
 * message bienveillant et des ressources d'aide.
 */
export function detectRiskSignals(history: GoalChangeEvent[]): RiskSignal[] {
  if (history.length === 0) {
    return [];
  }

  const events = [...history].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const signals = new Set<RiskSignal>();

  let subFloorCount = 0;
  let maxRateCount = 0;
  let targetWeightDecreases = 0;
  let previousTargetWeightKg: number | undefined;

  for (const event of events) {
    if (
      event.requestedDailyKcal !== undefined &&
      event.requestedDailyKcal < getMinimumDailyKcal(event.sex)
    ) {
      subFloorCount += 1;
    }

    if (event.requestedWeeklyRateKg !== undefined) {
      const cap = getMaxWeeklyRateKg(event.currentWeightKg);
      if (event.requestedWeeklyRateKg >= cap * RISK_MAX_RATE_TOLERANCE) {
        maxRateCount += 1;
      }
    }

    if (event.targetWeightKg !== undefined) {
      const targetBmi = calculateBmi({
        weightKg: event.targetWeightKg,
        heightCm: event.heightCm,
      });

      if (targetBmi < BMI_UNDERWEIGHT_THRESHOLD) {
        signals.add('underweight_target_requested');
      }

      if (previousTargetWeightKg !== undefined && event.targetWeightKg < previousTargetWeightKg) {
        targetWeightDecreases += 1;
      }

      previousTargetWeightKg = event.targetWeightKg;
    }
  }

  if (subFloorCount >= RISK_SUB_FLOOR_OCCURRENCES) {
    signals.add('repeated_sub_floor_targets');
  }
  if (targetWeightDecreases >= RISK_TARGET_WEIGHT_DECREASES) {
    signals.add('repeatedly_lowered_target_weight');
  }
  if (maxRateCount >= RISK_MAX_RATE_OCCURRENCES) {
    signals.add('persistent_maximum_rate');
  }

  return [...signals];
}

/** Valide un rythme hebdomadaire saisi par l'utilisateur avant tout calcul. */
export function assertUsableWeeklyRate(weeklyRateKg: number): void {
  if (!Number.isFinite(weeklyRateKg) || weeklyRateKg <= 0) {
    throw new InvalidInputError(
      'weeklyRateKg',
      `Le rythme hebdomadaire visé doit être strictement positif : ${weeklyRateKg}.`,
    );
  }
}
