import { InvalidBiometricsError, InvalidInputError } from '@/domain/errors';
import {
  ACTIVITY_FACTORS,
  ADAPTIVE_NOTIFY_THRESHOLD_KCAL,
  calculateBmr,
  calculateCalorieTarget,
  calculateTdee,
  deficitToWeeklyRateKg,
  recalculateForNewWeight,
  RECOMPOSITION_DEFICIT_KCAL,
  weeklyRateToDeficitKcal,
} from '@/domain/nutrition/energy';
import { MAX_DAILY_DEFICIT_KCAL } from '@/domain/nutrition/safety';

import { birthDateForAge, buildProfile, NOW } from '../profile-fixtures';

describe('calculateBmr — Mifflin-St Jeor', () => {
  it('calcule le BMR d’un homme de référence', () => {
    // 10×80 + 6.25×180 − 5×30 + 5 = 1780
    expect(calculateBmr({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 30 })).toBe(1780);
  });

  it('calcule le BMR d’une femme de référence', () => {
    // 10×80 + 6.25×180 − 5×30 − 161 = 1614
    expect(calculateBmr({ sex: 'female', weightKg: 80, heightCm: 180, ageYears: 30 })).toBe(1614);
  });

  it('creuse un écart de 166 kcal entre les sexes, par construction de la formule', () => {
    const shared = { weightKg: 65, heightCm: 168, ageYears: 42 } as const;
    expect(
      calculateBmr({ sex: 'male', ...shared }) - calculateBmr({ sex: 'female', ...shared }),
    ).toBe(166);
  });

  it('décroît avec l’âge, croît avec le poids et la taille', () => {
    const base = { sex: 'male', weightKg: 80, heightCm: 180, ageYears: 30 } as const;
    expect(calculateBmr({ ...base, ageYears: 50 })).toBeLessThan(calculateBmr(base));
    expect(calculateBmr({ ...base, weightKg: 90 })).toBeGreaterThan(calculateBmr(base));
    expect(calculateBmr({ ...base, heightCm: 190 })).toBeGreaterThan(calculateBmr(base));
  });

  it('renvoie un entier', () => {
    expect(
      Number.isInteger(
        calculateBmr({ sex: 'female', weightKg: 61.4, heightCm: 163, ageYears: 27 }),
      ),
    ).toBe(true);
  });

  it.each([
    ['poids négatif', { weightKg: -80, heightCm: 180, ageYears: 30 }],
    ['taille nulle', { weightKg: 80, heightCm: 0, ageYears: 30 }],
    ['âge aberrant', { weightKg: 80, heightCm: 180, ageYears: 200 }],
  ])('rejette une entrée invalide (%s)', (_label, input) => {
    expect(() => calculateBmr({ sex: 'male', ...input })).toThrow(InvalidBiometricsError);
  });
});

describe('calculateTdee', () => {
  it('multiplie le BMR par le facteur d’activité', () => {
    expect(calculateTdee(1780, 'moderately_active')).toBe(2759);
    expect(calculateTdee(1780, 'sedentary')).toBe(2136);
  });

  it('expose les facteurs de référence attendus', () => {
    expect(ACTIVITY_FACTORS).toEqual({
      sedentary: 1.2,
      lightly_active: 1.375,
      moderately_active: 1.55,
      very_active: 1.725,
      extremely_active: 1.9,
    });
  });

  it('croît strictement avec le niveau d’activité', () => {
    const levels = [
      'sedentary',
      'lightly_active',
      'moderately_active',
      'very_active',
      'extremely_active',
    ] as const;

    const values = levels.map((level) => calculateTdee(1780, level));
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
    expect(new Set(values).size).toBe(levels.length);
  });
});

describe('conversions rythme ↔ déficit', () => {
  it('traduit un rythme hebdomadaire en déficit quotidien', () => {
    // 0.5 kg/sem × 7700 / 7 = 550 kcal/j
    expect(weeklyRateToDeficitKcal(0.5)).toBe(550);
  });

  it('est réversible', () => {
    expect(deficitToWeeklyRateKg(weeklyRateToDeficitKcal(0.6))).toBe(0.6);
  });
});

describe('calculateCalorieTarget — cas nominaux', () => {
  it('applique le rythme par défaut de 0,75 %/semaine en perte de poids', () => {
    const result = calculateCalorieTarget(buildProfile(), NOW);

    expect(result).toEqual({
      bmrKcal: 1780,
      tdeeKcal: 2759,
      targetKcal: 2099, // 2759 − (80 × 0.0075 × 7700 / 7) = 2759 − 660
      appliedDeficitKcal: 660,
      effectiveWeeklyRateKg: 0.6,
      adjustments: [],
      warnings: [],
    });
  });

  it('renvoie exactement le TDEE au maintien, sans aucun ajustement', () => {
    const result = calculateCalorieTarget(buildProfile({ goalType: 'maintenance' }), NOW);

    expect(result.targetKcal).toBe(result.tdeeKcal);
    expect(result.appliedDeficitKcal).toBe(0);
    expect(result.effectiveWeeklyRateKg).toBe(0);
    expect(result.adjustments).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('reste proche du maintien en recomposition', () => {
    const result = calculateCalorieTarget(buildProfile({ goalType: 'recomposition' }), NOW);

    expect(result.targetKcal).toBe(result.tdeeKcal - RECOMPOSITION_DEFICIT_KCAL);
    expect(result.appliedDeficitKcal).toBe(RECOMPOSITION_DEFICIT_KCAL);
    expect(result.adjustments).toEqual([]);
  });

  it('respecte un rythme demandé qui reste sous le plafond', () => {
    const result = calculateCalorieTarget(buildProfile({ weeklyRateKg: 0.4 }), NOW);

    expect(result.appliedDeficitKcal).toBe(440);
    expect(result.effectiveWeeklyRateKg).toBe(0.4);
    expect(result.adjustments).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('ne mute pas le profil reçu', () => {
    const profile = Object.freeze(buildProfile({ weeklyRateKg: 2 }));
    expect(() => calculateCalorieTarget(profile, NOW)).not.toThrow();
    expect(profile.weeklyRateKg).toBe(2);
  });

  it('utilise l’instant courant par défaut', () => {
    const profile = buildProfile({ birthDate: birthDateForAge(30) });
    expect(calculateCalorieTarget(profile).targetKcal).toBeGreaterThan(0);
  });

  it('rejette un rythme demandé nul ou négatif', () => {
    expect(() => calculateCalorieTarget(buildProfile({ weeklyRateKg: 0 }), NOW)).toThrow(
      InvalidInputError,
    );
    expect(() => calculateCalorieTarget(buildProfile({ weeklyRateKg: -1 }), NOW)).toThrow(
      InvalidInputError,
    );
  });
});

describe('recalculateForNewWeight — recalcul adaptatif', () => {
  it('recalcule les trois chiffres à partir du nouveau poids', () => {
    const result = recalculateForNewWeight({ profile: buildProfile(), newWeightKg: 70, now: NOW });

    expect(result.previous.targetKcal).toBe(2099);
    expect(result.next.bmrKcal).toBe(1680);
    expect(result.next.tdeeKcal).toBe(2604);
    expect(result.next.targetKcal).toBe(2027);
    expect(result.weightDeltaKg).toBe(-10);
    expect(result.targetDeltaKcal).toBe(-72);
  });

  it('prévient l’utilisateur au-delà du seuil significatif', () => {
    const result = recalculateForNewWeight({ profile: buildProfile(), newWeightKg: 70, now: NOW });

    expect(Math.abs(result.targetDeltaKcal)).toBeGreaterThanOrEqual(ADAPTIVE_NOTIFY_THRESHOLD_KCAL);
    expect(result.shouldNotifyUser).toBe(true);
  });

  it('reste silencieux sur un micro-ajustement', () => {
    const result = recalculateForNewWeight({ profile: buildProfile(), newWeightKg: 74, now: NOW });

    expect(result.targetDeltaKcal).toBe(-43);
    expect(result.shouldNotifyUser).toBe(false);
  });

  it('prévient malgré un faible écart si un garde-fou vient de se déclencher', () => {
    const profile = buildProfile({
      sex: 'female',
      heightCm: 158,
      currentWeightKg: 81,
      birthDate: birthDateForAge(55),
      activityLevel: 'lightly_active',
    });

    const result = recalculateForNewWeight({ profile, newWeightKg: 80, now: NOW });

    expect(result.previous.adjustments).toEqual([]);
    expect(result.next.adjustments).toContain('floor_applied');
    expect(Math.abs(result.targetDeltaKcal)).toBeLessThan(ADAPTIVE_NOTIFY_THRESHOLD_KCAL);
    expect(result.shouldNotifyUser).toBe(true);
  });

  it('ne mute pas le profil reçu', () => {
    const profile = Object.freeze(buildProfile());
    recalculateForNewWeight({ profile, newWeightKg: 70, now: NOW });
    expect(profile.currentWeightKg).toBe(80);
  });

  it('rejette un nouveau poids implausible', () => {
    expect(() =>
      recalculateForNewWeight({ profile: buildProfile(), newWeightKg: 5, now: NOW }),
    ).toThrow(InvalidBiometricsError);
  });

  it('utilise l’instant courant par défaut', () => {
    const profile = buildProfile({ birthDate: birthDateForAge(30) });
    expect(() => recalculateForNewWeight({ profile, newWeightKg: 78 })).not.toThrow();
  });
});

describe('cohérence globale', () => {
  it('ne dépasse jamais le déficit quotidien maximal', () => {
    const result = calculateCalorieTarget(
      buildProfile({ currentWeightKg: 120, weeklyRateKg: 3 }),
      NOW,
    );

    expect(result.appliedDeficitKcal).toBeLessThanOrEqual(MAX_DAILY_DEFICIT_KCAL);
  });
});
