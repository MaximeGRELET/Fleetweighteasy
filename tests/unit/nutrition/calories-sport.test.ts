import { InvalidBiometricsError, InvalidInputError } from '@/domain/errors';
import { calculateCalorieTarget } from '@/domain/nutrition/energy';
import { getMinimumDailyKcal } from '@/domain/nutrition/safety';

import { buildProfile, NOW } from '../profile-fixtures';
import {
  applyCalorieMode,
  buildDualCalorieView,
  estimateCardioKcal,
  estimateCardioKcalFromEntry,
} from '@/domain/nutrition/calories-sport';
import {
  findMetEntry,
  listMetEntriesForActivity,
  MET_ENTRIES,
  RESISTANCE_TRAINING_MET_REFERENCE,
} from '@/domain/nutrition/mets-table';
import { DEFAULT_CALORIE_MODE } from '@/domain/profile/types';

describe('table METs', () => {
  it('couvre marche, course et vélo', () => {
    expect(listMetEntriesForActivity('walking')).toHaveLength(5);
    expect(listMetEntriesForActivity('running')).toHaveLength(5);
    expect(listMetEntriesForActivity('cycling')).toHaveLength(7);
    expect(MET_ENTRIES).toHaveLength(17);
  });

  it('utilise des identifiants uniques', () => {
    const ids = MET_ENTRIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('conserve les valeurs sourcées du Compendium', () => {
    expect(findMetEntry('walk_brisk')?.met).toBe(4.8);
    expect(findMetEntry('run_moderate')?.met).toBe(9.3);
    expect(findMetEntry('bike_moderate')?.met).toBe(8.0);
    expect(findMetEntry('bike_stationary_vigorous')?.met).toBe(10.5);
    expect(RESISTANCE_TRAINING_MET_REFERENCE).toBe(3.5);
  });

  it('classe les intensités par MET croissant au sein d’une activité', () => {
    const running = listMetEntriesForActivity('running').map((entry) => entry.met);
    expect(running).toEqual([...running].sort((a, b) => a - b));
  });

  it('renvoie undefined pour un identifiant inconnu', () => {
    expect(findMetEntry('nage_papillon')).toBeUndefined();
  });
});

describe('estimateCardioKcal', () => {
  it('reproduit l’exemple de contrôle de la spécification', () => {
    // 70 kg, marche rapide (4.8 MET), 30 min → 4.8 × 70 × 0.5 = 168 kcal
    expect(estimateCardioKcal({ metValue: 4.8, weightKg: 70, durationMin: 30 })).toBe(168);
  });

  it('applique kcal = MET × poids × durée en heures', () => {
    expect(estimateCardioKcal({ metValue: 9.3, weightKg: 70, durationMin: 45 })).toBe(488);
    expect(estimateCardioKcal({ metValue: 8, weightKg: 90, durationMin: 60 })).toBe(720);
  });

  it('renvoie zéro pour une durée nulle', () => {
    expect(estimateCardioKcal({ metValue: 10, weightKg: 70, durationMin: 0 })).toBe(0);
  });

  it('croît avec le poids, le MET et la durée', () => {
    const base = { metValue: 6, weightKg: 70, durationMin: 30 } as const;
    expect(estimateCardioKcal({ ...base, weightKg: 90 })).toBeGreaterThan(estimateCardioKcal(base));
    expect(estimateCardioKcal({ ...base, metValue: 9 })).toBeGreaterThan(estimateCardioKcal(base));
    expect(estimateCardioKcal({ ...base, durationMin: 60 })).toBeGreaterThan(
      estimateCardioKcal(base),
    );
  });

  it.each([0, 26, Number.NaN])('rejette la valeur MET %s', (metValue) => {
    expect(() => estimateCardioKcal({ metValue, weightKg: 70, durationMin: 30 })).toThrow(
      InvalidInputError,
    );
  });

  it.each([-1, 1441, Number.NaN])('rejette la durée %s', (durationMin) => {
    expect(() => estimateCardioKcal({ metValue: 6, weightKg: 70, durationMin })).toThrow(
      InvalidInputError,
    );
  });

  it('rejette un poids implausible', () => {
    expect(() => estimateCardioKcal({ metValue: 6, weightKg: 0, durationMin: 30 })).toThrow(
      InvalidBiometricsError,
    );
  });
});

describe('estimateCardioKcalFromEntry', () => {
  it('résout le MET depuis la table', () => {
    expect(
      estimateCardioKcalFromEntry({ metEntryId: 'walk_brisk', weightKg: 70, durationMin: 30 }),
    ).toBe(168);
  });

  it('rejette une activité absente de la table', () => {
    expect(() =>
      estimateCardioKcalFromEntry({ metEntryId: 'inconnu', weightKg: 70, durationMin: 30 }),
    ).toThrow(InvalidInputError);
  });
});

describe('applyCalorieMode', () => {
  it('est en mode fixe par défaut dans le modèle utilisateur', () => {
    expect(DEFAULT_CALORIE_MODE).toBe('fixed');
  });

  it('laisse le budget inchangé en mode fixe, quelle que soit la dépense', () => {
    for (const exerciseKcal of [0, 150, 800, 2000]) {
      const result = applyCalorieMode({ mode: 'fixed', targetKcal: 2000, exerciseKcal });

      expect(result.effectiveBudgetKcal).toBe(2000);
      expect(result.explanation).toBe('fixed_mode');
    }
  });

  it('ajoute exactement la dépense en mode recrédité', () => {
    const result = applyCalorieMode({ mode: 'credited', targetKcal: 2000, exerciseKcal: 450 });

    expect(result.effectiveBudgetKcal).toBe(2450);
    expect(result.explanation).toBe('credited_mode');
  });

  it.each([
    ['targetKcal', { targetKcal: -1, exerciseKcal: 0 }],
    ['exerciseKcal', { targetKcal: 2000, exerciseKcal: -50 }],
  ])('rejette une énergie négative sur %s', (_field, input) => {
    expect(() => applyCalorieMode({ mode: 'fixed', ...input })).toThrow(InvalidInputError);
  });
});

describe('buildDualCalorieView', () => {
  it('expose les deux vues simultanément pour la transparence en UI', () => {
    const view = buildDualCalorieView({ mode: 'fixed', targetKcal: 2000, exerciseKcal: 450 });

    expect(view.fixed.effectiveBudgetKcal).toBe(2000);
    expect(view.credited.effectiveBudgetKcal).toBe(2450);
    expect(view.active).toBe(view.fixed);
  });

  it('désigne la vue recréditée comme active dans ce mode', () => {
    const view = buildDualCalorieView({ mode: 'credited', targetKcal: 2000, exerciseKcal: 450 });

    expect(view.active).toBe(view.credited);
    expect(view.active.explanation).toBe('credited_mode');
  });
});

/**
 * Le crédit sportif rouvre du budget alimentaire : il doit rester sous les
 * mêmes garde-fous que le calcul d'objectif. Ces tests vérifient qu'aucune
 * séance, si longue soit-elle, ne peut faire passer le budget sous le plancher
 * calorique — le crédit **ajoute**, il ne retranche jamais.
 */
describe('le crédit sportif ne contourne pas le plancher calorique', () => {
  /** Profil dont l'objectif est déjà ramené au plancher par le garde-fou. */
  const FLOORED = buildProfile({
    sex: 'female',
    heightCm: 155,
    currentWeightKg: 50,
    activityLevel: 'sedentary',
    goalType: 'weight_loss',
    weeklyRateKg: 0.4,
  });

  it('part bien d’un objectif posé au plancher', () => {
    const target = calculateCalorieTarget(FLOORED, NOW);

    expect(target.adjustments).toContain('floor_applied');
    expect(target.targetKcal).toBe(getMinimumDailyKcal(FLOORED.sex));
  });

  it.each([0, 1, 300, 800, 2000, 5000])(
    'garde le budget au-dessus du plancher pour %i kcal de sport',
    (exerciseKcal) => {
      const target = calculateCalorieTarget(FLOORED, NOW);
      const floor = getMinimumDailyKcal(FLOORED.sex);
      const view = buildDualCalorieView({
        mode: 'credited',
        targetKcal: target.targetKcal,
        exerciseKcal,
      });

      expect(view.credited.effectiveBudgetKcal).toBeGreaterThanOrEqual(floor);
      expect(view.fixed.effectiveBudgetKcal).toBeGreaterThanOrEqual(floor);
    },
  );

  it('ne retranche jamais : le budget crédité est toujours ≥ le budget fixe', () => {
    for (const exerciseKcal of [0, 250, 900, 3000]) {
      const view = buildDualCalorieView({ mode: 'credited', targetKcal: 1200, exerciseKcal });

      expect(view.credited.effectiveBudgetKcal).toBeGreaterThanOrEqual(
        view.fixed.effectiveBudgetKcal,
      );
    }
  });

  it('refuse une dépense négative, qui seule pourrait creuser le budget', () => {
    // C'est le seul chemin par lequel un crédit pourrait passer sous le
    // plancher : il est fermé à l'entrée.
    expect(() =>
      applyCalorieMode({ mode: 'credited', targetKcal: 1200, exerciseKcal: -500 }),
    ).toThrow(InvalidInputError);
  });
});
