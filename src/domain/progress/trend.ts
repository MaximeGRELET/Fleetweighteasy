import { InvalidInputError } from '@/domain/errors';

import { compareIsoDates, daysBetween } from './calendar';
import type { WeightPoint } from './types';

/**
 * Lissage de la courbe de poids.
 *
 * Le poids corporel varie de un à deux kilos d'un jour à l'autre — eau,
 * glycogène, transit, cycle menstruel — sans qu'aucune masse grasse n'ait
 * bougé. Afficher les points bruts seuls conduit l'utilisateur à réagir à ce
 * bruit : c'est le mécanisme d'anxiété que la Phase 5 doit désamorcer
 * (PHASES_2_A_5 §5.2). La moyenne mobile est donc la donnée principale ; les
 * points bruts restent visibles, mais en second plan.
 */

/**
 * Sept jours : la fenêtre couvre exactement une semaine, donc un cycle complet
 * d'habitudes (repas de week-end compris). Une fenêtre plus courte laisse
 * passer le bruit, une plus longue rend la tendance trop lente à réagir.
 */
export const DEFAULT_TREND_WINDOW_DAYS = 7;

export interface TrendPoint {
  date: string;
  /** Pesée du jour, telle que saisie. */
  weightKg: number;
  /** Moyenne des pesées de la fenêtre glissante s'achevant à cette date. */
  trendKg: number;
  /**
   * Nombre de pesées entrées dans la moyenne.
   *
   * À 1, la « tendance » n'est que la pesée elle-même : l'UI doit alors éviter
   * de la présenter comme une tendance établie.
   */
  sampleCount: number;
}

/**
 * Construit la série lissée à partir des pesées.
 *
 * La fenêtre est exprimée en **jours**, pas en nombre de points. Une moyenne
 * sur les 7 dernières *pesées* couvrirait sept semaines chez quelqu'un qui se
 * pèse le dimanche : la tendance affichée retarderait alors d'un mois et demi.
 * En raisonnant par date, une pesée hebdomadaire et une pesée quotidienne
 * produisent la même échelle de temps.
 *
 * @param entries pesées, une par date (garanti par le schéma) ; l'ordre est libre
 */
export function buildWeightTrend(
  entries: readonly WeightPoint[],
  windowDays: number = DEFAULT_TREND_WINDOW_DAYS,
): TrendPoint[] {
  if (!Number.isInteger(windowDays) || windowDays < 1) {
    throw new InvalidInputError('windowDays', 'La fenêtre de lissage doit être d’au moins 1 jour.');
  }

  const sorted = [...entries].sort((a, b) => compareIsoDates(a.date, b.date));

  // Deux curseurs plutôt qu'une recherche par point : `start` ne recule jamais,
  // puisque les fenêtres avancent avec les dates.
  let start = 0;
  let windowSum = 0;

  return sorted.map((point, index) => {
    windowSum += point.weightKg;

    // La fenêtre est fermée à droite : elle contient `windowDays` jours en
    // comptant celui du point courant.
    while (daysBetween(sorted[start].date, point.date) >= windowDays) {
      windowSum -= sorted[start].weightKg;
      start += 1;
    }

    const sampleCount = index - start + 1;

    return {
      date: point.date,
      weightKg: point.weightKg,
      trendKg: roundToGram(windowSum / sampleCount),
      sampleCount,
    };
  });
}

/**
 * Poids de référence pour le recalcul adaptatif : la dernière valeur lissée.
 *
 * On ne recalcule **jamais** le métabolisme sur une pesée brute. Une journée
 * salée suffirait à faire varier l'objectif calorique, ce qui produirait
 * exactement les micro-ajustements que la spécification demande d'éviter
 * (PHASE_1 §8).
 */
export function resolveReferenceWeightKg(trend: readonly TrendPoint[]): number | undefined {
  return trend.length > 0 ? trend[trend.length - 1].trendKg : undefined;
}

/**
 * Variation sur la période, mesurée sur la tendance et non sur les points bruts.
 *
 * Signée : négative pour une perte. Comparer la première et la dernière pesée
 * brute ferait dépendre le bilan de deux journées prises au hasard — le même
 * mois pourrait s'afficher en perte ou en gain selon l'heure des pesées.
 */
export function trendChangeKg(trend: readonly TrendPoint[]): number | undefined {
  if (trend.length < 2) {
    return undefined;
  }

  return roundToGram(trend[trend.length - 1].trendKg - trend[0].trendKg);
}

/** Arrondi au gramme : au-delà, on afficherait une précision que la balance n'a pas. */
function roundToGram(value: number): number {
  return Math.round(value * 1000) / 1000;
}
