import {
  buildAdviceContext,
  detectRecentSlip,
  NEW_USER_DAYS,
  SLIP_LOOKBACK_DAYS,
  SLIP_OVER_BUDGET_RATIO,
  WEIGH_IN_WINDOW_DAYS,
  type DailyIntake,
} from '@/domain/advice/context';
import { addDays } from '@/domain/progress/calendar';

const TODAY = '2026-09-01';

/** Journée au budget tenu, sauf indication contraire. */
function day(daysAgo: number, consumedKcal = 1800, budgetKcal = 2000): DailyIntake {
  return { date: addDays(TODAY, -daysAgo), consumedKcal, budgetKcal };
}

describe('buildAdviceContext — ancienneté', () => {
  it('considère comme débutant tant que la première semaine n’est pas écoulée', () => {
    const context = buildAdviceContext({
      today: TODAY,
      startedOn: addDays(TODAY, -(NEW_USER_DAYS - 1)),
      loggedTodayCount: 0,
    });

    expect(context.isNewUser).toBe(true);
    expect(context.daysSinceStart).toBe(NEW_USER_DAYS - 1);
  });

  it('cesse de souhaiter la bienvenue au bout d’une semaine', () => {
    const context = buildAdviceContext({
      today: TODAY,
      startedOn: addDays(TODAY, -NEW_USER_DAYS),
      loggedTodayCount: 2,
    });

    expect(context.isNewUser).toBe(false);
  });

  it('traite l’absence totale d’activité comme un premier jour', () => {
    // Quelqu'un qui a terminé l'onboarding sans rien noter est bien un
    // débutant, quelle que soit la date à laquelle il l'a fait.
    const context = buildAdviceContext({ today: TODAY, loggedTodayCount: 0 });

    expect(context.daysSinceStart).toBe(0);
    expect(context.isNewUser).toBe(true);
  });
});

describe('buildAdviceContext — pesée de la semaine', () => {
  it('reconnaît une pesée dans la fenêtre', () => {
    const context = buildAdviceContext({
      today: TODAY,
      lastWeighedOn: addDays(TODAY, -(WEIGH_IN_WINDOW_DAYS - 1)),
      loggedTodayCount: 0,
    });

    expect(context.hasWeighedThisWeek).toBe(true);
  });

  it('considère la semaine écoulée sans pesée au-delà de la fenêtre', () => {
    const context = buildAdviceContext({
      today: TODAY,
      lastWeighedOn: addDays(TODAY, -WEIGH_IN_WINDOW_DAYS),
      loggedTodayCount: 0,
    });

    expect(context.hasWeighedThisWeek).toBe(false);
  });

  it('compte une pesée du jour', () => {
    const context = buildAdviceContext({
      today: TODAY,
      lastWeighedOn: TODAY,
      loggedTodayCount: 0,
    });

    expect(context.hasWeighedThisWeek).toBe(true);
  });

  it('ignore une pesée datée dans le futur plutôt que de s’y fier', () => {
    const context = buildAdviceContext({
      today: TODAY,
      lastWeighedOn: addDays(TODAY, 1),
      loggedTodayCount: 0,
    });

    expect(context.hasWeighedThisWeek).toBe(false);
  });

  it('n’invente pas de pesée quand il n’y en a aucune', () => {
    expect(buildAdviceContext({ today: TODAY, loggedTodayCount: 0 }).hasWeighedThisWeek).toBe(
      false,
    );
  });
});

describe('detectRecentSlip', () => {
  it('repère un dépassement marqué du jour', () => {
    expect(detectRecentSlip([day(0, 2000 * SLIP_OVER_BUDGET_RATIO, 2000)], TODAY)).toBe(true);
  });

  it('ne compte pas un dépassement modéré comme un écart', () => {
    // 10 % au-dessus : c'est le bruit d'une estimation de portion, pas une
    // sortie au restaurant.
    expect(detectRecentSlip([day(0, 2200, 2000)], TODAY)).toBe(false);
  });

  it('ne compte pas une journée sous le budget', () => {
    expect(detectRecentSlip([day(0)], TODAY)).toBe(false);
  });

  it('regarde la veille autant qu’aujourd’hui', () => {
    expect(detectRecentSlip([day(1, 3000, 2000)], TODAY)).toBe(true);
  });

  it('oublie un écart passé, dont le conseil n’a plus de sens', () => {
    // « Reprends au prochain repas » ne veut plus rien dire trois jours après.
    expect(detectRecentSlip([day(SLIP_LOOKBACK_DAYS, 3000, 2000)], TODAY)).toBe(false);
  });

  it('ignore une journée postérieure à aujourd’hui', () => {
    expect(
      detectRecentSlip([{ date: addDays(TODAY, 1), consumedKcal: 3000, budgetKcal: 2000 }], TODAY),
    ).toBe(false);
  });

  it('ignore une journée sans budget exploitable', () => {
    // Un budget nul rend le rapport dénué de sens : on n'invente pas d'écart.
    expect(detectRecentSlip([{ date: TODAY, consumedKcal: 3000, budgetKcal: 0 }], TODAY)).toBe(
      false,
    );
  });

  it('ne conclut rien sur un historique vide', () => {
    expect(detectRecentSlip([], TODAY)).toBe(false);
  });

  it('suffit d’une seule journée en écart parmi plusieurs', () => {
    expect(detectRecentSlip([day(0), day(1, 3000, 2000)], TODAY)).toBe(true);
  });
});

describe('buildAdviceContext — progression', () => {
  it('reprend la détection de plateau de la Phase 5', () => {
    expect(
      buildAdviceContext({ today: TODAY, loggedTodayCount: 0, progress: { status: 'plateau' } })
        .plateauDetected,
    ).toBe(true);

    expect(
      buildAdviceContext({ today: TODAY, loggedTodayCount: 0, progress: { status: 'on_track' } })
        .plateauDetected,
    ).toBe(false);
  });

  it('n’affirme aucune tendance sans rythme observé', () => {
    expect(buildAdviceContext({ today: TODAY, loggedTodayCount: 0 }).weightTrend).toBe(
      'insufficient_data',
    );

    expect(
      buildAdviceContext({ today: TODAY, loggedTodayCount: 0, progress: { status: 'on_track' } })
        .weightTrend,
    ).toBe('insufficient_data');
  });

  it('lit la tendance sur la pente, pas sur le statut', () => {
    const trendFor = (observedWeeklyRateKg: number) =>
      buildAdviceContext({
        today: TODAY,
        loggedTodayCount: 0,
        progress: { status: 'on_track', observedWeeklyRateKg },
      }).weightTrend;

    expect(trendFor(-0.6)).toBe('down');
    expect(trendFor(0.6)).toBe('up');
    expect(trendFor(0)).toBe('stable');
  });

  it('traite une variation dans la bande de bruit comme stable', () => {
    const trendFor = (observedWeeklyRateKg: number) =>
      buildAdviceContext({
        today: TODAY,
        loggedTodayCount: 0,
        progress: { status: 'on_track', observedWeeklyRateKg },
      }).weightTrend;

    // Même bande que la Phase 5 : les deux couches ne peuvent pas qualifier
    // différemment la même série.
    expect(trendFor(-0.25)).toBe('stable');
    expect(trendFor(0.25)).toBe('stable');
  });

  it('reste « stable » pour un maintien réussi, là où le statut dit « sur son rythme »', () => {
    const context = buildAdviceContext({
      today: TODAY,
      loggedTodayCount: 0,
      progress: { status: 'on_track', observedWeeklyRateKg: 0 },
    });

    expect(context.weightTrend).toBe('stable');
  });
});

describe('buildAdviceContext — journal', () => {
  it('reporte le nombre d’entrées du jour', () => {
    expect(buildAdviceContext({ today: TODAY, loggedTodayCount: 4 }).loggedTodayCount).toBe(4);
  });

  it('reporte la détection d’écart', () => {
    expect(
      buildAdviceContext({
        today: TODAY,
        loggedTodayCount: 2,
        recentDays: [day(0, 3000, 2000)],
      }).recentSlipDetected,
    ).toBe(true);
  });
});
