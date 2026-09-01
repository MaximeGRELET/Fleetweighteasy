import { buildDailyBudget, type DailyBudgetInput } from '@/domain/journal/daily-budget';
import type { DailyTotals } from '@/domain/journal/types';
import type { MacroResult } from '@/domain/nutrition/macros';

const MACROS: MacroResult = {
  proteinG: 140,
  fatG: 60,
  carbsG: 180,
  energyKcal: 1820,
  adjustments: [],
};

const CONSUMED: DailyTotals = {
  kcal: 1200,
  proteinG: 90,
  carbsG: 120,
  fatG: 40,
  fiberG: 12,
};

function buildInput(overrides: Partial<DailyBudgetInput> = {}): DailyBudgetInput {
  return {
    mode: 'fixed',
    targetKcal: 1800,
    macros: MACROS,
    consumed: CONSUMED,
    exerciseKcal: 300,
    ...overrides,
  };
}

describe('buildDailyBudget — mode fixed', () => {
  it('n’ajoute pas la dépense sportive au budget', () => {
    const budget = buildDailyBudget(buildInput({ mode: 'fixed', exerciseKcal: 300 }));

    expect(budget.active.mode).toBe('fixed');
    expect(budget.active.budgetKcal).toBe(1800);
    expect(budget.active.explanation).toBe('fixed_mode');
  });

  it('affiche quand même le sport, séparément', () => {
    // Le sport n'augmente pas le budget mais il n'est pas caché pour autant :
    // c'est la condition pour que le mode reste compréhensible.
    const budget = buildDailyBudget(buildInput({ mode: 'fixed', exerciseKcal: 420 }));

    expect(budget.exerciseKcal).toBe(420);
  });

  it('laisse le budget inchangé quelle que soit la dépense', () => {
    const withoutSport = buildDailyBudget(buildInput({ mode: 'fixed', exerciseKcal: 0 }));
    const withSport = buildDailyBudget(buildInput({ mode: 'fixed', exerciseKcal: 900 }));

    expect(withSport.active.budgetKcal).toBe(withoutSport.active.budgetKcal);
  });

  it('tient l’autre vue prête, pour la transparence', () => {
    const budget = buildDailyBudget(buildInput({ mode: 'fixed', exerciseKcal: 300 }));

    expect(budget.alternative.mode).toBe('credited');
    expect(budget.alternative.budgetKcal).toBe(2100);
    expect(budget.alternative.explanation).toBe('credited_mode');
  });
});

describe('buildDailyBudget — mode credited', () => {
  it('ajoute exactement la dépense estimée', () => {
    const budget = buildDailyBudget(buildInput({ mode: 'credited', exerciseKcal: 300 }));

    expect(budget.active.mode).toBe('credited');
    expect(budget.active.budgetKcal).toBe(2100);
    expect(budget.active.explanation).toBe('credited_mode');
  });

  it('propose le mode fixe comme vue alternative', () => {
    const budget = buildDailyBudget(buildInput({ mode: 'credited' }));

    expect(budget.alternative.mode).toBe('fixed');
    expect(budget.alternative.budgetKcal).toBe(1800);
  });

  it('rejoint le mode fixe quand aucun sport n’a été enregistré', () => {
    const budget = buildDailyBudget(buildInput({ mode: 'credited', exerciseKcal: 0 }));

    expect(budget.active.budgetKcal).toBe(budget.alternative.budgetKcal);
  });
});

describe('buildDailyBudget — restant', () => {
  it('soustrait le consommé du budget', () => {
    const budget = buildDailyBudget(buildInput({ mode: 'fixed' }));

    expect(budget.consumedKcal).toBe(1200);
    expect(budget.active.remainingKcal).toBe(600);
    expect(budget.active.overBudget).toBe(false);
  });

  it('assume un restant négatif plutôt que de le tronquer à zéro', () => {
    // Masquer le dépassement priverait l'utilisateur de l'information la plus
    // utile de la journée. On l'affiche, sans dramatiser.
    const budget = buildDailyBudget(
      buildInput({ consumed: { ...CONSUMED, kcal: 2100 }, mode: 'fixed' }),
    );

    expect(budget.active.remainingKcal).toBe(-300);
    expect(budget.active.overBudget).toBe(true);
  });

  it('ne signale pas de dépassement quand le budget est atteint pile', () => {
    const budget = buildDailyBudget(
      buildInput({ consumed: { ...CONSUMED, kcal: 1800 }, mode: 'fixed' }),
    );

    expect(budget.active.remainingKcal).toBe(0);
    expect(budget.active.overBudget).toBe(false);
  });

  it('calcule le restant de chaque vue avec son propre budget', () => {
    const budget = buildDailyBudget(buildInput({ mode: 'fixed', exerciseKcal: 300 }));

    expect(budget.active.remainingKcal).toBe(600);
    expect(budget.alternative.remainingKcal).toBe(900);
  });
});

describe('buildDailyBudget — macros', () => {
  it('rapporte le consommé à la cible, macro par macro', () => {
    const budget = buildDailyBudget(buildInput());

    expect(budget.protein).toEqual({
      consumedG: 90,
      targetG: 140,
      remainingG: 50,
      ratio: 90 / 140,
    });
    expect(budget.carbs.remainingG).toBe(60);
    expect(budget.fat.remainingG).toBe(20);
  });

  it('laisse le ratio dépasser 1 : c’est à l’UI de tronquer la barre', () => {
    const budget = buildDailyBudget(buildInput({ consumed: { ...CONSUMED, proteinG: 210 } }));

    expect(budget.protein.ratio).toBe(1.5);
    expect(budget.protein.remainingG).toBe(-70);
  });

  it('ne divise jamais par zéro, même sur une cible absente', () => {
    const budget = buildDailyBudget(buildInput({ macros: { ...MACROS, carbsG: 0 } }));

    expect(budget.carbs.ratio).toBe(0);
    expect(Number.isFinite(budget.carbs.remainingG)).toBe(true);
  });

  it('remonte les fibres consommées sans leur opposer de cible', () => {
    // Aucune cible de fibres n'est fixée par le domaine : on affiche le
    // consommé, on n'invente pas un objectif que personne n'a calculé.
    expect(buildDailyBudget(buildInput()).fiberG).toBe(12);
  });

  it('évite les artefacts de virgule flottante sur le restant', () => {
    const budget = buildDailyBudget(
      buildInput({
        macros: { ...MACROS, fatG: 60.3 },
        consumed: { ...CONSUMED, fatG: 20.1 },
      }),
    );

    expect(budget.fat.remainingG).toBe(40.2);
  });
});
