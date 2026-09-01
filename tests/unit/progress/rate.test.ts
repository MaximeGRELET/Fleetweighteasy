import {
  estimateObservedRate,
  MIN_ENTRIES_FOR_RATE,
  MIN_SPAN_DAYS_FOR_RATE,
} from '@/domain/progress/rate';

import { dailySeries, linearLoss, seriesAt } from './weight-fixtures';

describe('estimateObservedRate', () => {
  it('retrouve la pente d’une perte régulière', () => {
    const rate = estimateObservedRate(
      linearLoss({ days: 21, startWeightKg: 85, lossPerDayKg: 0.1 }),
    );

    expect(rate).toEqual({ weeklyRateKg: -0.7, spanDays: 20, entryCount: 21 });
  });

  it('est signée : une reprise donne une pente positive', () => {
    const rate = estimateObservedRate(
      linearLoss({ days: 21, startWeightKg: 80, lossPerDayKg: -0.05 }),
    );

    expect(rate?.weeklyRateKg).toBeCloseTo(0.35, 3);
  });

  it('vaut zéro sur un poids parfaitement stable', () => {
    const rate = estimateObservedRate(dailySeries(Array.from({ length: 21 }, () => 80)));

    expect(rate?.weeklyRateKg).toBe(0);
  });

  it('résiste à une pesée aberrante, là où une différence de bornes s’y ferait piéger', () => {
    // Perte régulière de 0,1 kg/jour, mais la dernière pesée est faussée de +2 kg.
    const points = linearLoss({ days: 21, startWeightKg: 85, lossPerDayKg: 0.1 });
    points[points.length - 1] = {
      ...points[points.length - 1],
      weightKg: points[points.length - 1].weightKg + 2,
    };

    const rate = estimateObservedRate(points);

    // La différence première/dernière donnerait 0 kg perdu ; la régression voit
    // encore une perte franche.
    expect(rate?.weeklyRateKg).toBeLessThan(-0.4);
  });

  it('accepte une cadence irrégulière', () => {
    // Pesées espacées inégalement, perte de 0,1 kg/jour.
    const rate = estimateObservedRate(
      seriesAt([
        [28, 84],
        [21, 83.3],
        [7, 81.9],
        [0, 81.2],
      ]),
    );

    expect(rate?.weeklyRateKg).toBeCloseTo(-0.7, 2);
    expect(rate?.spanDays).toBe(28);
  });

  it('ne conclut rien sous le nombre minimal de pesées', () => {
    const points = seriesAt([
      [30, 84],
      [0, 82],
    ]);

    expect(points).toHaveLength(MIN_ENTRIES_FOR_RATE - 1);
    expect(estimateObservedRate(points)).toBeUndefined();
  });

  it('ne conclut rien sur une durée trop courte, même avec beaucoup de pesées', () => {
    // Treize jours d'écart : une chute d'eau de début de régime donnerait ici
    // un « −3 kg par semaine » que rien ne soutient.
    const points = dailySeries([
      84, 83.5, 83, 82.8, 82.5, 82.3, 82, 81.8, 81.5, 81.3, 81, 81, 80.8, 80.5,
    ]);

    expect(estimateObservedRate(points)).toBeUndefined();
  });

  it('conclut dès que la durée minimale est exactement atteinte', () => {
    const points = linearLoss({
      days: MIN_SPAN_DAYS_FOR_RATE + 1,
      startWeightKg: 85,
      lossPerDayKg: 0.1,
    });

    expect(points).toHaveLength(15);
    expect(estimateObservedRate(points)?.spanDays).toBe(MIN_SPAN_DAYS_FOR_RATE);
  });

  it('ne dépend pas de l’ordre reçu et ne modifie pas la série', () => {
    const points = linearLoss({ days: 21, startWeightKg: 85, lossPerDayKg: 0.1 });
    const shuffled = [...points].reverse();
    const snapshot = structuredClone(shuffled);

    expect(estimateObservedRate(shuffled)).toEqual(estimateObservedRate(points));
    expect(shuffled).toEqual(snapshot);
  });
});
