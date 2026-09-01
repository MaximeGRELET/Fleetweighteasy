import { addDays } from '@/domain/progress/calendar';
import type { WeightPoint } from '@/domain/progress/types';

/** Date de référence figée : les tests du domaine restent déterministes. */
export const TODAY = '2026-09-01';

/**
 * Série de pesées se terminant aujourd'hui, une par jour, en partant du plus
 * ancien. `weights[0]` est donc la pesée la plus ancienne.
 */
export function dailySeries(weights: readonly number[], endDate = TODAY): WeightPoint[] {
  return weights.map((weightKg, index) => ({
    date: addDays(endDate, index - (weights.length - 1)),
    weightKg,
  }));
}

/** Série à cadence libre : `[joursAvantAujourdHui, poids]`. */
export function seriesAt(
  points: readonly (readonly [number, number])[],
  endDate = TODAY,
): WeightPoint[] {
  return points.map(([daysAgo, weightKg]) => ({ date: addDays(endDate, -daysAgo), weightKg }));
}

/** Perte linéaire parfaite : `days` pesées quotidiennes, `lossPerDay` kg par jour. */
export function linearLoss(input: {
  days: number;
  startWeightKg: number;
  lossPerDayKg: number;
  endDate?: string;
}): WeightPoint[] {
  const weights = Array.from(
    { length: input.days },
    (_, index) => input.startWeightKg - index * input.lossPerDayKg,
  );

  return dailySeries(weights, input.endDate ?? TODAY);
}
