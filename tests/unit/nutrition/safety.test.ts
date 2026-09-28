import { InvalidInputError } from '@/domain/errors';
import { calculateCalorieTarget } from '@/domain/nutrition/energy';
import {
  assertUsableWeeklyRate,
  BMI_UNDERWEIGHT_THRESHOLD,
  buildGoalChangeEvent,
  checkTargetWeightSafety,
  DEFAULT_WEEKLY_RATE_FRACTION,
  detectRiskSignals,
  getDefaultWeeklyRateKg,
  getMaxWeeklyRateKg,
  getMinimumDailyKcal,
  type GoalChangeEvent,
  hasGoalChanged,
  KCAL_PER_KG_FAT,
  MAX_DAILY_DEFICIT_KCAL,
  MAX_WEEKLY_RATE_FRACTION,
  MIN_DAILY_KCAL_FEMALE,
  MIN_DAILY_KCAL_MALE,
  RISK_MAX_RATE_OCCURRENCES,
  suggestMinimumHealthyTargetWeightKg,
} from '@/domain/nutrition/safety';
import { calculateBmi } from '@/domain/profile/bmi';
import type { ActivityLevel, GoalType, Sex } from '@/domain/profile/types';

import { birthDateForAge, buildProfile, NOW } from '../profile-fixtures';

/**
 * Ce fichier est le plus fourni de la Phase 1 : il couvre les garde-fous de
 * sécurité, la partie la plus sensible de l'application.
 */

describe('constantes de sécurité', () => {
  it('conserve les valeurs sourcées', () => {
    // Toute modification de ces seuils doit être un acte délibéré, revalidé
    // par un professionnel de santé (PHASE_1 §12).
    expect(MIN_DAILY_KCAL_FEMALE).toBe(1200);
    expect(MIN_DAILY_KCAL_MALE).toBe(1500);
    expect(MAX_DAILY_DEFICIT_KCAL).toBe(750);
    expect(MAX_WEEKLY_RATE_FRACTION).toBe(0.01);
    expect(DEFAULT_WEEKLY_RATE_FRACTION).toBe(0.0075);
    expect(KCAL_PER_KG_FAT).toBe(7700);
    expect(BMI_UNDERWEIGHT_THRESHOLD).toBe(18.5);
  });

  it('applique le bon plancher selon le sexe', () => {
    expect(getMinimumDailyKcal('female')).toBe(MIN_DAILY_KCAL_FEMALE);
    expect(getMinimumDailyKcal('male')).toBe(MIN_DAILY_KCAL_MALE);
  });

  it('dérive les rythmes du poids corporel', () => {
    expect(getMaxWeeklyRateKg(80)).toBeCloseTo(0.8, 10);
    expect(getDefaultWeeklyRateKg(80)).toBeCloseTo(0.6, 10);
    expect(getDefaultWeeklyRateKg(80)).toBeLessThan(getMaxWeeklyRateKg(80));
  });
});

describe('garde-fou : rythme trop agressif', () => {
  it('plafonne le rythme ET le déficit pour une demande de 2 kg/semaine', () => {
    const result = calculateCalorieTarget(
      buildProfile({ currentWeightKg: 90, weeklyRateKg: 2 }),
      NOW,
    );

    expect(result.adjustments).toEqual(['rate_capped', 'deficit_capped']);
    expect(result.warnings).toContain('aggressive_rate_requested');
    expect(result.appliedDeficitKcal).toBe(MAX_DAILY_DEFICIT_KCAL);
    expect(result.targetKcal).toBe(2164); // 2914 − 750
    expect(result.effectiveWeeklyRateKg).toBe(0.682);
    expect(result.effectiveWeeklyRateKg).toBeLessThan(2);
  });

  it('plafonne le rythme sans plafonner le déficit chez une personne légère', () => {
    // 55 kg → plafond 0.55 kg/sem → déficit 605 kcal, sous le maximum de 750.
    const result = calculateCalorieTarget(
      buildProfile({ currentWeightKg: 55, weeklyRateKg: 1.5, heightCm: 170 }),
      NOW,
    );

    expect(result.adjustments).toContain('rate_capped');
    expect(result.adjustments).not.toContain('deficit_capped');
    expect(result.appliedDeficitKcal).toBe(605);
  });

  it('plafonne le déficit même sans rythme demandé, chez une personne lourde', () => {
    // 120 kg → défaut 0.9 kg/sem → 990 kcal, ramené à 750.
    const result = calculateCalorieTarget(buildProfile({ currentWeightKg: 120 }), NOW);

    expect(result.adjustments).toEqual(['deficit_capped']);
    expect(result.warnings).toEqual([]); // rien n'a été *demandé* d'agressif
    expect(result.appliedDeficitKcal).toBe(MAX_DAILY_DEFICIT_KCAL);
  });
});

describe('garde-fou : plancher calorique', () => {
  it('ramène une femme sédentaire au plancher de 1200 kcal', () => {
    const result = calculateCalorieTarget(
      buildProfile({
        sex: 'female',
        currentWeightKg: 50,
        heightCm: 155,
        birthDate: birthDateForAge(60),
        activityLevel: 'sedentary',
      }),
      NOW,
    );

    expect(result.tdeeKcal).toBe(1210);
    expect(result.targetKcal).toBe(MIN_DAILY_KCAL_FEMALE);
    expect(result.adjustments).toContain('floor_applied');
    expect(result.warnings).toContain('target_below_healthy_floor');
    // Le rythme affiché est recalculé, donc bien plus lent que celui visé.
    expect(result.effectiveWeeklyRateKg).toBe(0.009);
  });

  it('ramène un homme au plancher de 1500 kcal', () => {
    const result = calculateCalorieTarget(
      buildProfile({
        sex: 'male',
        currentWeightKg: 55,
        heightCm: 160,
        birthDate: birthDateForAge(70),
        activityLevel: 'sedentary',
      }),
      NOW,
    );

    expect(result.targetKcal).toBe(MIN_DAILY_KCAL_MALE);
    expect(result.adjustments).toContain('floor_applied');
    // Le plancher prime sur le TDEE : l'objectif peut devenir un léger surplus.
    expect(result.appliedDeficitKcal).toBeLessThan(0);
  });

  it('applique aussi le plancher au maintien', () => {
    const result = calculateCalorieTarget(
      buildProfile({
        sex: 'female',
        goalType: 'maintenance',
        currentWeightKg: 42,
        heightCm: 150,
        birthDate: birthDateForAge(75),
        activityLevel: 'sedentary',
      }),
      NOW,
    );

    expect(result.tdeeKcal).toBeLessThan(MIN_DAILY_KCAL_FEMALE);
    expect(result.targetKcal).toBe(MIN_DAILY_KCAL_FEMALE);
    expect(result.adjustments).toContain('floor_applied');
  });
});

describe('garde-fou : poids cible menant à l’insuffisance pondérale', () => {
  it('signale un poids cible à IMC 17', () => {
    const profile = buildProfile({ heightCm: 170, targetWeightKg: 49 });

    expect(calculateBmi({ weightKg: 49, heightCm: 170 })).toBe(17);
    expect(checkTargetWeightSafety(profile)).toEqual(['goal_leads_to_underweight']);
    expect(calculateCalorieTarget(profile, NOW).warnings).toContain('goal_leads_to_underweight');
  });

  it('ne signale rien pour un poids cible sain', () => {
    expect(checkTargetWeightSafety(buildProfile({ heightCm: 170, targetWeightKg: 68 }))).toEqual(
      [],
    );
  });

  it('ne signale rien en l’absence de poids cible', () => {
    expect(checkTargetWeightSafety(buildProfile())).toEqual([]);
  });

  it('accepte tout juste le poids correspondant à l’IMC plancher', () => {
    const heightCm = 170;
    const targetWeightKg = suggestMinimumHealthyTargetWeightKg(heightCm);

    expect(targetWeightKg).toBe(53.5);
    expect(checkTargetWeightSafety(buildProfile({ heightCm, targetWeightKg }))).toEqual([]);
  });
});

describe('assertUsableWeeklyRate', () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejette %s', (value) => {
    expect(() => assertUsableWeeklyRate(value)).toThrow(InvalidInputError);
  });

  it('accepte un rythme positif', () => {
    expect(() => assertUsableWeeklyRate(0.5)).not.toThrow();
  });
});

describe('detectRiskSignals', () => {
  const baseEvent: GoalChangeEvent = {
    at: '2026-01-01T00:00:00Z',
    sex: 'female',
    currentWeightKg: 60,
    heightCm: 165,
  };

  it('ne signale rien sur un historique vide', () => {
    expect(detectRiskSignals([])).toEqual([]);
  });

  it('ne signale rien sur un historique sain', () => {
    expect(
      detectRiskSignals([
        { ...baseEvent, targetWeightKg: 58, requestedWeeklyRateKg: 0.3, requestedDailyKcal: 1700 },
        {
          ...baseEvent,
          at: '2026-03-01T00:00:00Z',
          targetWeightKg: 58,
          requestedWeeklyRateKg: 0.4,
          requestedDailyKcal: 1650,
        },
      ]),
    ).toEqual([]);
  });

  it('signale des objectifs répétés sous le plancher', () => {
    const signals = detectRiskSignals([
      { ...baseEvent, requestedDailyKcal: 1100 },
      { ...baseEvent, at: '2026-02-01T00:00:00Z', requestedDailyKcal: 900 },
    ]);

    expect(signals).toContain('repeated_sub_floor_targets');
  });

  it('ne signale pas une demande isolée sous le plancher', () => {
    expect(detectRiskSignals([{ ...baseEvent, requestedDailyKcal: 1100 }])).toEqual([]);
  });

  it('tient compte du plancher propre à chaque sexe', () => {
    // 1300 kcal est sous le plancher masculin (1500) mais pas le féminin (1200).
    const male = { ...baseEvent, sex: 'male' as Sex, requestedDailyKcal: 1300 };
    expect(detectRiskSignals([male, { ...male, at: '2026-02-01T00:00:00Z' }])).toContain(
      'repeated_sub_floor_targets',
    );

    const female = { ...baseEvent, requestedDailyKcal: 1300 };
    expect(detectRiskSignals([female, { ...female, at: '2026-02-01T00:00:00Z' }])).toEqual([]);
  });

  it('signale un poids cible révisé plusieurs fois à la baisse', () => {
    const signals = detectRiskSignals([
      { ...baseEvent, at: '2026-01-01T00:00:00Z', targetWeightKg: 58 },
      { ...baseEvent, at: '2026-02-01T00:00:00Z', targetWeightKg: 55 },
      { ...baseEvent, at: '2026-03-01T00:00:00Z', targetWeightKg: 53 },
    ]);

    expect(signals).toContain('repeatedly_lowered_target_weight');
  });

  it('ne compte pas les révisions à la hausse ou stables', () => {
    const signals = detectRiskSignals([
      { ...baseEvent, at: '2026-01-01T00:00:00Z', targetWeightKg: 58 },
      { ...baseEvent, at: '2026-02-01T00:00:00Z', targetWeightKg: 55 },
      { ...baseEvent, at: '2026-03-01T00:00:00Z', targetWeightKg: 55 },
      { ...baseEvent, at: '2026-04-01T00:00:00Z', targetWeightKg: 57 },
    ]);

    expect(signals).not.toContain('repeatedly_lowered_target_weight');
  });

  it('analyse l’historique dans l’ordre chronologique, même reçu en désordre', () => {
    const events: GoalChangeEvent[] = [
      { ...baseEvent, at: '2026-03-01T00:00:00Z', targetWeightKg: 53 },
      { ...baseEvent, at: '2026-01-01T00:00:00Z', targetWeightKg: 58 },
      { ...baseEvent, at: '2026-02-01T00:00:00Z', targetWeightKg: 55 },
    ];

    expect(detectRiskSignals(events)).toContain('repeatedly_lowered_target_weight');
  });

  it('ne mute pas l’historique reçu', () => {
    const events: GoalChangeEvent[] = [
      { ...baseEvent, at: '2026-03-01T00:00:00Z', targetWeightKg: 53 },
      { ...baseEvent, at: '2026-01-01T00:00:00Z', targetWeightKg: 58 },
    ];
    const snapshot = events.map((event) => event.at);

    detectRiskSignals(events);

    expect(events.map((event) => event.at)).toEqual(snapshot);
  });

  it('signale un rythme systématiquement poussé au maximum', () => {
    const atMax = { ...baseEvent, requestedWeeklyRateKg: 0.6 }; // plafond = 0.6 pour 60 kg
    const signals = detectRiskSignals([
      { ...atMax, at: '2026-01-01T00:00:00Z' },
      { ...atMax, at: '2026-02-01T00:00:00Z' },
      { ...atMax, at: '2026-03-01T00:00:00Z' },
    ]);

    expect(signals).toContain('persistent_maximum_rate');
  });

  it('ne signale pas un rythme poussé au maximum une fois de moins que le seuil', () => {
    const atMax = { ...baseEvent, requestedWeeklyRateKg: 0.6 };
    const events = Array.from({ length: RISK_MAX_RATE_OCCURRENCES - 1 }, (_unused, index) => ({
      ...atMax,
      at: `2026-0${index + 1}-01T00:00:00Z`,
    }));

    expect(detectRiskSignals(events)).not.toContain('persistent_maximum_rate');
  });

  it('signale un poids cible sous l’IMC plancher, même isolé', () => {
    expect(detectRiskSignals([{ ...baseEvent, targetWeightKg: 45 }])).toEqual([
      'underweight_target_requested',
    ]);
  });

  it('cumule plusieurs signaux sans doublon', () => {
    const signals = detectRiskSignals([
      {
        ...baseEvent,
        at: '2026-01-01T00:00:00Z',
        targetWeightKg: 46,
        requestedDailyKcal: 1000,
        requestedWeeklyRateKg: 0.6,
      },
      {
        ...baseEvent,
        at: '2026-02-01T00:00:00Z',
        targetWeightKg: 44,
        requestedDailyKcal: 950,
        requestedWeeklyRateKg: 0.6,
      },
      {
        ...baseEvent,
        at: '2026-03-01T00:00:00Z',
        targetWeightKg: 42,
        requestedDailyKcal: 900,
        requestedWeeklyRateKg: 0.6,
      },
    ]);

    expect(new Set(signals).size).toBe(signals.length);
    expect(signals).toEqual(
      expect.arrayContaining([
        'underweight_target_requested',
        'repeated_sub_floor_targets',
        'repeatedly_lowered_target_weight',
        'persistent_maximum_rate',
      ]),
    );
  });
});

describe('hasGoalChanged', () => {
  const previous = buildProfile({ goalType: 'weight_loss', targetWeightKg: 60, weeklyRateKg: 0.5 });

  it('considère le premier enregistrement comme un objectif défini', () => {
    expect(hasGoalChanged(undefined, previous)).toBe(true);
  });

  it.each([
    ['le type d’objectif', { goalType: 'maintenance' as GoalType }],
    ['le poids cible', { targetWeightKg: 58 }],
    ['le retrait du poids cible', { targetWeightKg: undefined }],
    ['le rythme', { weeklyRateKg: 0.6 }],
  ])('détecte un changement portant sur %s', (_label, patch) => {
    expect(hasGoalChanged(previous, { ...previous, ...patch })).toBe(true);
  });

  /**
   * Le recalcul adaptatif réécrit le poids courant à chaque demi-kilo perdu :
   * l'historiser noierait les vraies révisions dans des événements subis.
   */
  it('ignore une réécriture qui ne touche pas à l’objectif', () => {
    expect(
      hasGoalChanged(previous, { ...previous, currentWeightKg: 70, lastNotifiedWeightKg: 72 }),
    ).toBe(false);
  });
});

describe('buildGoalChangeEvent', () => {
  const at = new Date('2026-04-01T09:30:00.000Z');

  it('photographie l’objectif et la biométrie du moment', () => {
    const profile = buildProfile({ targetWeightKg: 60, weeklyRateKg: 0.5 });

    expect(buildGoalChangeEvent(profile, at)).toEqual({
      at: '2026-04-01T09:30:00.000Z',
      sex: profile.sex,
      currentWeightKg: profile.currentWeightKg,
      heightCm: profile.heightCm,
      targetWeightKg: 60,
      requestedWeeklyRateKg: 0.5,
    });
  });

  it('garde le rythme demandé, même au-delà du plafond appliqué au calcul', () => {
    const profile = buildProfile({ currentWeightKg: 60, weeklyRateKg: 2 });

    expect(buildGoalChangeEvent(profile, at).requestedWeeklyRateKg).toBe(2);
    expect(getMaxWeeklyRateKg(60)).toBeLessThan(2);
  });

  it('omet les champs absents du profil', () => {
    const event = buildGoalChangeEvent(
      buildProfile({ targetWeightKg: undefined, weeklyRateKg: undefined }),
      at,
    );

    expect('targetWeightKg' in event).toBe(false);
    expect('requestedWeeklyRateKg' in event).toBe(false);
    expect('requestedDailyKcal' in event).toBe(false);
  });
});

describe('preuve : aucun chemin de calcul ne produit un objectif dangereux', () => {
  const sexes: Sex[] = ['male', 'female'];
  const goals: GoalType[] = ['weight_loss', 'recomposition', 'maintenance'];
  const activityLevels: ActivityLevel[] = [
    'sedentary',
    'lightly_active',
    'moderately_active',
    'very_active',
    'extremely_active',
  ];
  const weights = [25, 50, 70, 90, 120, 250];
  const heights = [150, 165, 180, 200];
  const ages = [18, 30, 50, 75];
  const rates: (number | undefined)[] = [undefined, 0.3, 1, 2, 5];

  it('balaye toutes les combinaisons sans jamais passer sous le plancher', () => {
    let combinations = 0;

    for (const sex of sexes) {
      for (const goalType of goals) {
        for (const activityLevel of activityLevels) {
          for (const currentWeightKg of weights) {
            for (const heightCm of heights) {
              for (const ageYears of ages) {
                for (const weeklyRateKg of rates) {
                  combinations += 1;

                  const result = calculateCalorieTarget(
                    buildProfile({
                      sex,
                      goalType,
                      activityLevel,
                      currentWeightKg,
                      heightCm,
                      birthDate: birthDateForAge(ageYears),
                      weeklyRateKg,
                    }),
                    NOW,
                  );

                  // 1. Le plancher calorique n'est jamais franchi.
                  expect(result.targetKcal).toBeGreaterThanOrEqual(getMinimumDailyKcal(sex));

                  // 2. L'objectif est un entier exploitable.
                  expect(Number.isInteger(result.targetKcal)).toBe(true);

                  // 3. Le déficit ne dépasse jamais le maximum de sécurité.
                  expect(result.appliedDeficitKcal).toBeLessThanOrEqual(MAX_DAILY_DEFICIT_KCAL);

                  // 4. Le rythme effectif reste sous le plafond de 1 %/semaine
                  //    (tolérance : arrondi à l'entier de l'objectif calorique).
                  expect(result.effectiveWeeklyRateKg).toBeLessThanOrEqual(
                    getMaxWeeklyRateKg(currentWeightKg) + 0.001,
                  );

                  // 5. Aucun ajustement silencieux : un plancher appliqué est
                  //    toujours accompagné de son avertissement.
                  if (result.adjustments.includes('floor_applied')) {
                    expect(result.warnings).toContain('target_below_healthy_floor');
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(combinations).toBe(
      sexes.length *
        goals.length *
        activityLevels.length *
        weights.length *
        heights.length *
        ages.length *
        rates.length,
    );
  });
});
