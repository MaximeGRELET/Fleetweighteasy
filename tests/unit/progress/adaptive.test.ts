import { ADAPTIVE_NOTIFY_THRESHOLD_KCAL } from '@/domain/nutrition/energy';
import {
  ADAPTIVE_MIN_WEIGHT_DELTA_KG,
  applyAdaptiveWeight,
  evaluateAdaptiveTarget,
} from '@/domain/progress/adaptive';

import { buildProfile, NOW } from '../profile-fixtures';

describe('evaluateAdaptiveTarget — seuil de réalignement', () => {
  it('ne touche pas au profil pour une variation sous le bruit de la balance', () => {
    const profile = buildProfile({ currentWeightKg: 80 });

    const evaluation = evaluateAdaptiveTarget({
      profile,
      referenceWeightKg: 80 - (ADAPTIVE_MIN_WEIGHT_DELTA_KG - 0.01),
      now: NOW,
    });

    expect(evaluation.shouldUpdateProfile).toBe(false);
    expect(evaluation.recalculation).toBeUndefined();
    expect(evaluation.shouldNotifyUser).toBe(false);
  });

  it('réaligne le profil dès que le seuil est atteint', () => {
    const evaluation = evaluateAdaptiveTarget({
      profile: buildProfile({ currentWeightKg: 80 }),
      referenceWeightKg: 80 - ADAPTIVE_MIN_WEIGHT_DELTA_KG,
      now: NOW,
    });

    expect(evaluation.shouldUpdateProfile).toBe(true);
    expect(evaluation.recalculation).toBeDefined();
  });

  it('rapporte l’écart signé', () => {
    expect(
      evaluateAdaptiveTarget({
        profile: buildProfile({ currentWeightKg: 80 }),
        referenceWeightKg: 77.4,
        now: NOW,
      }).weightDeltaKg,
    ).toBe(-2.6);

    expect(
      evaluateAdaptiveTarget({
        profile: buildProfile({ currentWeightKg: 80 }),
        referenceWeightKg: 82.5,
        now: NOW,
      }).weightDeltaKg,
    ).toBe(2.5);
  });
});

describe('evaluateAdaptiveTarget — seuil de notification', () => {
  it('réaligne sans prévenir tant que l’objectif bouge à peine', () => {
    // Un demi-kilo déplace l'objectif de quelques kcal : le dire n'apprendrait
    // rien et installerait une inquiétude de fond.
    const evaluation = evaluateAdaptiveTarget({
      profile: buildProfile({ currentWeightKg: 80 }),
      referenceWeightKg: 79.4,
      now: NOW,
    });

    expect(evaluation.shouldUpdateProfile).toBe(true);
    expect(Math.abs(evaluation.recalculation?.targetDeltaKcal ?? 0)).toBeLessThan(
      ADAPTIVE_NOTIFY_THRESHOLD_KCAL,
    );
    expect(evaluation.shouldNotifyUser).toBe(false);
  });

  it('prévient quand l’objectif bouge assez pour se voir', () => {
    // Il faut une perte franche : le rythme visé étant proportionnel au poids,
    // le déficit se resserre en même temps que la dépense, et l’objectif bouge
    // beaucoup moins vite que le TDEE (2 914 → 2 759 kcal de dépense, mais
    // 2 172 → 2 099 kcal d’objectif).
    const evaluation = evaluateAdaptiveTarget({
      profile: buildProfile({ currentWeightKg: 90 }),
      referenceWeightKg: 80,
      now: NOW,
    });

    expect(evaluation.shouldNotifyUser).toBe(true);
    expect(Math.abs(evaluation.recalculation?.targetDeltaKcal ?? 0)).toBeGreaterThanOrEqual(
      ADAPTIVE_NOTIFY_THRESHOLD_KCAL,
    );
  });

  it('prévient toujours lorsqu’un garde-fou se déclenche, même pour un petit écart', () => {
    // Femme sédentaire dont l'objectif frôle le plancher : à 71 kg il tient à
    // 1 204 kcal, à 70 kg le calcul tombe à 1 192 et le plancher le remonte à
    // 1 200. L'objectif ne bouge que de 4 kcal — bien en dessous du seuil de
    // notification — mais un garde-fou vient d'apparaître, et un garde-fou
    // n'est jamais silencieux.
    const profile = buildProfile({
      sex: 'female',
      heightCm: 170,
      currentWeightKg: 71,
      activityLevel: 'sedentary',
      goalType: 'weight_loss',
      weeklyRateKg: 0.5,
    });

    const evaluation = evaluateAdaptiveTarget({ profile, referenceWeightKg: 70, now: NOW });

    expect(evaluation.recalculation?.previous.adjustments).not.toContain('floor_applied');
    expect(evaluation.recalculation?.next.adjustments).toContain('floor_applied');
    expect(Math.abs(evaluation.recalculation?.targetDeltaKcal ?? 0)).toBeLessThan(
      ADAPTIVE_NOTIFY_THRESHOLD_KCAL,
    );
    expect(evaluation.shouldNotifyUser).toBe(true);
  });
});

describe('evaluateAdaptiveTarget — recalcul', () => {
  it('recalcule BMR, TDEE et objectif sur le nouveau poids', () => {
    const evaluation = evaluateAdaptiveTarget({
      profile: buildProfile({ currentWeightKg: 90 }),
      referenceWeightKg: 84,
      now: NOW,
    });

    const { previous, next } = evaluation.recalculation ?? {};

    expect(next?.bmrKcal).toBeLessThan(previous?.bmrKcal ?? 0);
    expect(next?.tdeeKcal).toBeLessThan(previous?.tdeeKcal ?? 0);
    expect(next?.targetKcal).toBeLessThan(previous?.targetKcal ?? 0);
  });

  it('relève l’objectif quand le poids augmente', () => {
    const evaluation = evaluateAdaptiveTarget({
      profile: buildProfile({ currentWeightKg: 80 }),
      referenceWeightKg: 88,
      now: NOW,
    });

    expect(evaluation.recalculation?.targetDeltaKcal).toBeGreaterThan(0);
  });

  it('ne mute pas le profil reçu', () => {
    const profile = buildProfile({ currentWeightKg: 80 });

    evaluateAdaptiveTarget({ profile, referenceWeightKg: 74, now: NOW });

    expect(profile.currentWeightKg).toBe(80);
  });
});

describe('applyAdaptiveWeight', () => {
  it('renvoie un profil réaligné sans modifier l’original', () => {
    const profile = buildProfile({ currentWeightKg: 80 });
    const updated = applyAdaptiveWeight(profile, 77.5);

    expect(updated.currentWeightKg).toBe(77.5);
    expect(profile.currentWeightKg).toBe(80);
    expect(updated.goalType).toBe(profile.goalType);
  });
});
