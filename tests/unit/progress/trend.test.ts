import { InvalidInputError } from '@/domain/errors';
import {
  buildWeightTrend,
  DEFAULT_TREND_WINDOW_DAYS,
  resolveReferenceWeightKg,
  trendChangeKg,
} from '@/domain/progress/trend';

import { dailySeries, seriesAt } from './weight-fixtures';

describe('buildWeightTrend', () => {
  it('lisse la fluctuation quotidienne au lieu de la reproduire', () => {
    // Une balance qui alterne 80 et 82 kg autour d'une vraie valeur de 81.
    const trend = buildWeightTrend(dailySeries([80, 82, 80, 82, 80, 82, 80]));
    const last = trend[trend.length - 1];

    expect(last.weightKg).toBe(80);
    expect(last.trendKg).toBeCloseTo(80.857, 3);
    expect(last.sampleCount).toBe(7);
  });

  it('calcule une moyenne mobile arrière, pas centrée', () => {
    const trend = buildWeightTrend(dailySeries([80, 81, 82]), 3);

    // Chaque point ne voit que le passé : la courbe ne se réécrit jamais
    // rétroactivement quand une nouvelle pesée arrive.
    expect(trend.map((point) => point.trendKg)).toEqual([80, 80.5, 81]);
    expect(trend.map((point) => point.sampleCount)).toEqual([1, 2, 3]);
  });

  it('raisonne en jours et non en nombre de pesées', () => {
    // Quatre pesées hebdomadaires : sur une fenêtre de 7 jours, chacune est
    // seule dans la sienne. Une moyenne sur « les 7 dernières pesées »
    // couvrirait ici sept semaines.
    const trend = buildWeightTrend(
      seriesAt([
        [21, 84],
        [14, 83],
        [7, 82],
        [0, 81],
      ]),
    );

    expect(trend.map((point) => point.sampleCount)).toEqual([1, 1, 1, 1]);
    expect(trend.map((point) => point.trendKg)).toEqual([84, 83, 82, 81]);
  });

  it('exclut le point qui sort de la fenêtre à la journée près', () => {
    // Fenêtre de 7 jours : le point à J−7 est dehors, celui à J−6 est dedans.
    const trend = buildWeightTrend(
      seriesAt([
        [7, 90],
        [6, 80],
        [0, 80],
      ]),
    );

    expect(trend[2].sampleCount).toBe(2);
    expect(trend[2].trendKg).toBe(80);
  });

  it('trie la série : le résultat ne dépend pas de l’ordre reçu', () => {
    const points = dailySeries([80, 81, 82]);
    const shuffled = [points[2], points[0], points[1]];

    expect(buildWeightTrend(shuffled, 3)).toEqual(buildWeightTrend(points, 3));
  });

  it('ne modifie pas la série reçue', () => {
    const points = dailySeries([82, 80, 81]);
    const snapshot = structuredClone(points);

    buildWeightTrend(points);

    expect(points).toEqual(snapshot);
  });

  it('renvoie une série vide pour un historique vide', () => {
    expect(buildWeightTrend([])).toEqual([]);
  });

  it('accepte une fenêtre d’un seul jour, qui ne lisse rien', () => {
    const trend = buildWeightTrend(dailySeries([80, 82]), 1);

    expect(trend.map((point) => point.trendKg)).toEqual([80, 82]);
  });

  it('refuse une fenêtre nulle ou fractionnaire', () => {
    expect(() => buildWeightTrend([], 0)).toThrow(InvalidInputError);
    expect(() => buildWeightTrend([], 2.5)).toThrow(InvalidInputError);
  });

  it('utilise une fenêtre de sept jours par défaut', () => {
    expect(DEFAULT_TREND_WINDOW_DAYS).toBe(7);
    expect(buildWeightTrend(dailySeries([80, 81, 82, 83, 84, 85, 86, 87]))).toEqual(
      buildWeightTrend(dailySeries([80, 81, 82, 83, 84, 85, 86, 87]), 7),
    );
  });
});

describe('resolveReferenceWeightKg', () => {
  it('retient la tendance et non la dernière pesée brute', () => {
    // Journée salée : la balance affiche 83 alors que la tendance est à 81.
    const trend = buildWeightTrend(dailySeries([81, 80, 81, 80, 81, 80, 83]));

    expect(resolveReferenceWeightKg(trend)).toBeCloseTo(80.857, 3);
    expect(resolveReferenceWeightKg(trend)).not.toBe(83);
  });

  it('n’a pas de référence sans pesée', () => {
    expect(resolveReferenceWeightKg([])).toBeUndefined();
  });
});

describe('trendChangeKg', () => {
  it('mesure la variation sur la tendance, signée', () => {
    const trend = buildWeightTrend(dailySeries([84, 83, 82, 81]), 1);

    expect(trendChangeKg(trend)).toBe(-3);
  });

  it('est positive quand le poids remonte', () => {
    const trend = buildWeightTrend(dailySeries([80, 81, 82]), 1);

    expect(trendChangeKg(trend)).toBe(2);
  });

  it('ne conclut rien à partir d’un seul point', () => {
    expect(trendChangeKg(buildWeightTrend(dailySeries([80])))).toBeUndefined();
    expect(trendChangeKg([])).toBeUndefined();
  });
});
