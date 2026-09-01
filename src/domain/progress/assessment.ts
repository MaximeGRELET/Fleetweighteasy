import type { ObservedRate } from './rate';
import type { ProgressStatus } from './types';

/**
 * Lecture du rythme réel au regard du rythme visé.
 *
 * Cette fonction ne juge pas : elle classe. Le vocabulaire est choisi pour que
 * la couche message n'ait jamais besoin d'un ton culpabilisant — « plus lent que
 * prévu » est un fait, et le plan est une hypothèse au moins autant que le
 * comportement de l'utilisateur.
 *
 * Les seuils sont volontairement bas : un statut déclenché à tort coûte un
 * message rassurant de trop, un statut manqué laisse quelqu'un sans explication
 * devant une courbe qui stagne.
 */

/**
 * Trois semaines avant de parler de plateau.
 *
 * Deux semaines de stagnation sont un événement banal — rétention d'eau après
 * une reprise du sport, phase lutéale, un week-end. Nommer cela « plateau »
 * inquiéterait pour un phénomène qui se résout seul.
 */
export const PLATEAU_MIN_SPAN_DAYS = 21;

/** Quatre pesées sur trois semaines : en dessous, la pente n'est pas soutenue. */
export const PLATEAU_MIN_ENTRIES = 4;

/**
 * En dessous du quart du rythme visé, on considère que la courbe ne descend
 * plus. Le seuil est haut exprès : à ce stade l'utilisateur a déjà constaté
 * lui-même que rien ne bouge, et lui expliquer pourquoi vaut mieux que d'attendre
 * une stagnation parfaite.
 */
export const PLATEAU_RATE_FRACTION = 0.25;

/** Au-delà des trois quarts du rythme visé, le plan est tenu. */
export const ON_TRACK_RATE_FRACTION = 0.75;

/**
 * Bande de stabilité, en kg/semaine.
 *
 * Sert deux fois : elle définit « se maintenir » quand aucune perte n'est
 * planifiée, et la tolérance au-delà de laquelle une hausse est signalée. À
 * 0,25 kg/semaine, elle absorbe le bruit de mesure sans masquer une vraie
 * reprise.
 */
export const STABLE_BAND_WEEKLY_KG = 0.25;

/** Un rythme visé sous ce seuil équivaut à un objectif de maintien. */
const PLANNED_RATE_EPSILON = 0.01;

export interface ProgressAssessmentInput {
  /** Rythme observé, ou `undefined` si la période ne permet pas de l'estimer. */
  observed: ObservedRate | undefined;
  /** Rythme visé, en kg/semaine de **perte** (positif). Vient de `effectiveWeeklyRateKg`. */
  plannedWeeklyLossKg: number;
  /** Plafond de sécurité pour le poids courant. Vient de `getMaxWeeklyRateKg`. */
  maxSafeWeeklyLossKg: number;
}

export function assessProgress(input: ProgressAssessmentInput): ProgressStatus {
  const { observed, plannedWeeklyLossKg, maxSafeWeeklyLossKg } = input;

  if (!observed) {
    return 'insufficient_data';
  }

  // Tout le raisonnement se fait en « perte », donc en positif : une pente de
  // −0,4 kg/semaine devient une perte de 0,4. Cela évite d'avoir à retourner
  // mentalement chaque comparaison.
  const observedWeeklyLossKg = -observed.weeklyRateKg;

  // La sécurité passe avant la conformité au plan : perdre plus vite que le
  // plafond n'est pas une bonne nouvelle, même si l'objectif est la perte.
  if (observedWeeklyLossKg > maxSafeWeeklyLossKg) {
    return 'faster_than_safe';
  }

  if (observedWeeklyLossKg < -STABLE_BAND_WEEKLY_KG) {
    return 'gaining';
  }

  // Aucune perte planifiée (maintien, ou plancher calorique ayant annulé le
  // déficit) : le succès, c'est de rester dans la bande.
  if (plannedWeeklyLossKg < PLANNED_RATE_EPSILON) {
    // Une perte non planifiée reste une information : la passer pour un maintien
    // réussi masquerait un déficit involontaire.
    return observedWeeklyLossKg <= STABLE_BAND_WEEKLY_KG ? 'on_track' : 'unplanned_loss';
  }

  if (observedWeeklyLossKg >= plannedWeeklyLossKg * ON_TRACK_RATE_FRACTION) {
    return 'on_track';
  }

  if (
    observedWeeklyLossKg < plannedWeeklyLossKg * PLATEAU_RATE_FRACTION &&
    observed.spanDays >= PLATEAU_MIN_SPAN_DAYS &&
    observed.entryCount >= PLATEAU_MIN_ENTRIES
  ) {
    return 'plateau';
  }

  return 'slower_than_planned';
}

/**
 * Le statut que le moteur de conseils de la Phase 6 doit traiter en priorité.
 *
 * Exposé ici pour que la règle de déclenchement de la brique « plateau » vive
 * dans le domaine, et non dans le futur moteur — sans quoi les deux couches
 * porteraient chacune leur idée de ce qu'est un plateau.
 */
export function isPlateau(status: ProgressStatus): boolean {
  return status === 'plateau';
}
