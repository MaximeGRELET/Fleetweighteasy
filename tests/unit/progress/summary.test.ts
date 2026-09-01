import {
  buildProgressSummary,
  historySpanDays,
  resolvePeriodStart,
  type ProgressSummaryInput,
} from '@/domain/progress/summary';

import { dailySeries, linearLoss, seriesAt, TODAY } from './weight-fixtures';

function buildInput(overrides: Partial<ProgressSummaryInput> = {}): ProgressSummaryInput {
  return {
    entries: linearLoss({ days: 30, startWeightKg: 85, lossPerDayKg: 0.1 }),
    period: 'all',
    plannedWeeklyLossKg: 0.6,
    maxSafeWeeklyLossKg: 0.85,
    today: TODAY,
    ...overrides,
  };
}

describe('resolvePeriodStart', () => {
  it('inclut aujourd’hui dans la période : 30 jours, c’est J−29 à J', () => {
    expect(resolvePeriodStart('30d', '2026-09-01')).toBe('2026-08-03');
  });

  it('borne la période de 90 jours', () => {
    expect(resolvePeriodStart('90d', '2026-09-01')).toBe('2026-06-04');
  });

  it('ne borne rien pour l’historique complet', () => {
    expect(resolvePeriodStart('all', '2026-09-01')).toBeUndefined();
  });
});

describe('buildProgressSummary — découpage par période', () => {
  it('ne retient que les pesées de la période', () => {
    const summary = buildProgressSummary(buildInput({ period: '30d' }));

    expect(summary.points).toHaveLength(30);
    expect(summary.range).toEqual({ fromDate: '2026-08-03', toDate: TODAY });
  });

  it('écarte les pesées antérieures à la fenêtre', () => {
    const summary = buildProgressSummary(
      buildInput({
        entries: seriesAt([
          [200, 90],
          [10, 82],
          [0, 81],
        ]),
        period: '30d',
      }),
    );

    expect(summary.points.map((point) => point.weightKg)).toEqual([82, 81]);
  });

  it('lisse sur l’historique complet avant de restreindre à la période', () => {
    // Sans cela, le premier point affiché repartirait d'une moyenne à un seul
    // échantillon et la courbe montrerait une marche qui n'existe pas.
    const entries = linearLoss({ days: 60, startWeightKg: 88, lossPerDayKg: 0.1 });
    const summary = buildProgressSummary(buildInput({ entries, period: '30d' }));

    expect(summary.trend[0].sampleCount).toBe(7);
  });

  it('trie les pesées reçues dans le désordre', () => {
    const entries = [...dailySeries([84, 83, 82])].reverse();
    const summary = buildProgressSummary(buildInput({ entries, period: 'all' }));

    expect(summary.points.map((point) => point.weightKg)).toEqual([84, 83, 82]);
  });

  it('reste calculable sur un historique vide', () => {
    const summary = buildProgressSummary(buildInput({ entries: [] }));

    expect(summary.points).toEqual([]);
    expect(summary.trend).toEqual([]);
    expect(summary.changeKg).toBeUndefined();
    expect(summary.observed).toBeUndefined();
    expect(summary.status).toBe('insufficient_data');
    expect(summary.referenceWeightKg).toBeUndefined();
    expect(summary.goal).toBeUndefined();
  });
});

describe('buildProgressSummary — indicateurs', () => {
  it('mesure la variation sur la tendance et le rythme réel', () => {
    const summary = buildProgressSummary(buildInput());

    expect(summary.changeKg).toBeCloseTo(-2.6, 1);
    expect(summary.observed?.weeklyRateKg).toBeCloseTo(-0.7, 2);
    expect(summary.status).toBe('on_track');
  });

  it('retient la tendance, et non la dernière pesée, comme poids de référence', () => {
    const entries = linearLoss({ days: 30, startWeightKg: 85, lossPerDayKg: 0.1 });
    entries[entries.length - 1] = { ...entries[entries.length - 1], weightKg: 84 };

    const summary = buildProgressSummary(buildInput({ entries }));

    expect(summary.referenceWeightKg).toBeLessThan(83);
  });

  it('garde la même référence adaptative quelle que soit la période affichée', () => {
    const entries = linearLoss({ days: 120, startWeightKg: 92, lossPerDayKg: 0.05 });

    const short = buildProgressSummary(buildInput({ entries, period: '30d' }));
    const full = buildProgressSummary(buildInput({ entries, period: 'all' }));

    // Changer de filtre d'affichage ne doit pas changer l'objectif calorique.
    expect(short.referenceWeightKg).toBe(full.referenceWeightKg);
  });

  it('reporte le rythme visé tel qu’il lui est fourni', () => {
    expect(
      buildProgressSummary(buildInput({ plannedWeeklyLossKg: 0.42 })).plannedWeeklyLossKg,
    ).toBe(0.42);
  });
});

describe('buildProgressSummary — progression vers la cible', () => {
  it('mesure le chemin parcouru depuis la première pesée', () => {
    const summary = buildProgressSummary(
      buildInput({
        entries: linearLoss({ days: 30, startWeightKg: 85, lossPerDayKg: 0.1 }),
        targetWeightKg: 78,
      }),
    );

    expect(summary.goal?.startWeightKg).toBe(85);
    expect(summary.goal?.targetWeightKg).toBe(78);
    expect(summary.goal?.remainingKg).toBeCloseTo(4.4, 1);
    expect(summary.goal?.ratio).toBeGreaterThan(0.3);
    expect(summary.goal?.ratio).toBeLessThan(0.4);
  });

  it('part de la première pesée et non du poids courant, pour que la barre ne recule jamais', () => {
    const entries = linearLoss({ days: 60, startWeightKg: 90, lossPerDayKg: 0.1 });

    const early = buildProgressSummary(
      buildInput({ entries: entries.slice(0, 30), targetWeightKg: 80, today: entries[29].date }),
    );
    const later = buildProgressSummary(buildInput({ entries, targetWeightKg: 80 }));

    expect(later.goal?.startWeightKg).toBe(early.goal?.startWeightKg);
    expect(later.goal?.ratio).toBeGreaterThan(early.goal?.ratio ?? 0);
  });

  it('ne borne pas le rapport : une cible dépassée le dit', () => {
    const summary = buildProgressSummary(
      buildInput({
        entries: linearLoss({ days: 30, startWeightKg: 85, lossPerDayKg: 0.2 }),
        targetWeightKg: 82,
      }),
    );

    expect(summary.goal?.ratio).toBeGreaterThan(1);
    expect(summary.goal?.remainingKg).toBeLessThan(0);
  });

  it('n’affiche aucune progression sans poids cible', () => {
    expect(buildProgressSummary(buildInput()).goal).toBeUndefined();
  });

  it('ne divise pas par zéro quand la cible est déjà le poids de départ', () => {
    const summary = buildProgressSummary(
      buildInput({ entries: dailySeries([80]), targetWeightKg: 80 }),
    );

    expect(summary.goal?.ratio).toBe(1);
    expect(Number.isFinite(summary.goal?.ratio)).toBe(true);
  });
});

describe('historySpanDays', () => {
  it('mesure le recul disponible', () => {
    expect(historySpanDays(linearLoss({ days: 30, startWeightKg: 85, lossPerDayKg: 0.1 }))).toBe(
      29,
    );
  });

  it('vaut zéro tant qu’il n’y a pas deux pesées', () => {
    expect(historySpanDays([])).toBe(0);
    expect(historySpanDays(dailySeries([80]))).toBe(0);
  });

  it('ne dépend pas de l’ordre reçu', () => {
    const points = dailySeries([84, 83, 82]);

    expect(historySpanDays([...points].reverse())).toBe(2);
  });
});
