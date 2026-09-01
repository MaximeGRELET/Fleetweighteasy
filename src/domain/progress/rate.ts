import { compareIsoDates, daysBetween } from './calendar';
import type { WeightPoint } from './types';

/**
 * Rythme réel de variation du poids.
 *
 * Estimé par régression linéaire sur **tous** les points de la période, et non
 * par différence entre la première et la dernière pesée : cette différence
 * dépendrait entièrement de deux journées prises au hasard, alors que la
 * régression fait contribuer chaque pesée. C'est aussi ce qui rend la détection
 * de plateau fiable — un plateau, c'est une pente nulle, pas deux nombres égaux.
 */

const DAYS_PER_WEEK = 7;

/**
 * Deux semaines avant d'annoncer un rythme.
 *
 * En dessous, la pente est dominée par les variations d'eau : on afficherait des
 * « 2 kg par semaine » qui ne se produiront pas, puis leur démenti la semaine
 * suivante. Ne rien dire est plus juste, et moins anxiogène, que dire trop tôt.
 */
export const MIN_SPAN_DAYS_FOR_RATE = 14;

/** Trois points : deux suffisent à tracer une droite, mais pas à la démentir. */
export const MIN_ENTRIES_FOR_RATE = 3;

export interface ObservedRate {
  /** Pente en kg/semaine. **Signée** : négative pour une perte. */
  weeklyRateKg: number;
  /** Nombre de jours entre la première et la dernière pesée retenue. */
  spanDays: number;
  entryCount: number;
}

/**
 * Estime le rythme réel, ou renvoie `undefined` quand les données ne le
 * permettent pas encore.
 *
 * L'absence de résultat est un cas normal, pas une erreur : c'est ce qui permet
 * à l'UI de dire « encore un peu de patience » au lieu d'afficher un chiffre
 * que rien ne soutient.
 */
export function estimateObservedRate(points: readonly WeightPoint[]): ObservedRate | undefined {
  if (points.length < MIN_ENTRIES_FOR_RATE) {
    return undefined;
  }

  const sorted = [...points].sort((a, b) => compareIsoDates(a.date, b.date));
  const origin = sorted[0].date;
  const spanDays = daysBetween(origin, sorted[sorted.length - 1].date);

  if (spanDays < MIN_SPAN_DAYS_FOR_RATE) {
    return undefined;
  }

  // Moindres carrés : pente = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)².
  const xs = sorted.map((point) => daysBetween(origin, point.date));
  const ys = sorted.map((point) => point.weightKg);
  const meanX = average(xs);
  const meanY = average(ys);

  let covariance = 0;
  let variance = 0;

  for (let index = 0; index < sorted.length; index += 1) {
    const deltaX = xs[index] - meanX;
    covariance += deltaX * (ys[index] - meanY);
    variance += deltaX * deltaX;
  }

  // `spanDays >= 14` garantit au moins deux abscisses distinctes, donc une
  // variance non nulle : la division est sûre.
  const slopePerDay = covariance / variance;

  return {
    weeklyRateKg: roundToGram(slopePerDay * DAYS_PER_WEEK),
    spanDays,
    entryCount: sorted.length,
  };
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function roundToGram(value: number): number {
  return Math.round(value * 1000) / 1000;
}
