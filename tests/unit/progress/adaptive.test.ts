import { ADAPTIVE_NOTIFY_THRESHOLD_KCAL, calculateCalorieTarget } from '@/domain/nutrition/energy';
import {
  ADAPTIVE_MIN_WEIGHT_DELTA_KG,
  applyAdaptiveEvaluation,
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
    expect(evaluation.shouldNotifyUser).toBe(false);
  });

  it('réaligne le profil dès que le seuil est atteint', () => {
    const evaluation = evaluateAdaptiveTarget({
      profile: buildProfile({ currentWeightKg: 80 }),
      referenceWeightKg: 80 - ADAPTIVE_MIN_WEIGHT_DELTA_KG,
      now: NOW,
    });

    expect(evaluation.shouldUpdateProfile).toBe(true);
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

describe('applyAdaptiveEvaluation', () => {
  it('réaligne le poids sans modifier le profil d’origine', () => {
    const profile = buildProfile({ currentWeightKg: 80 });
    const evaluation = evaluateAdaptiveTarget({ profile, referenceWeightKg: 77.5, now: NOW });
    const updated = applyAdaptiveEvaluation(profile, evaluation);

    expect(updated.currentWeightKg).toBe(77.5);
    expect(profile.currentWeightKg).toBe(80);
    expect(updated.goalType).toBe(profile.goalType);
  });

  it('épingle la base d’annonce au poids d’avant, quand le réalignement est silencieux', () => {
    const profile = buildProfile({ currentWeightKg: 80 });

    const quiet = evaluateAdaptiveTarget({ profile, referenceWeightKg: 79.4, now: NOW });
    const updated = applyAdaptiveEvaluation(profile, quiet);

    expect(quiet.shouldNotifyUser).toBe(false);
    expect(updated.currentWeightKg).toBe(79.4);
    // La base reste à 80 : c'est le poids du dernier objectif montré. La laisser
    // suivre le poids courant remettrait l'écart cumulé à zéro à chaque palier.
    expect(updated.lastNotifiedWeightKg).toBe(80);
  });

  it('déplace la base d’annonce quand une notification part', () => {
    const profile = buildProfile({ currentWeightKg: 80 });

    const loud = evaluateAdaptiveTarget({ profile, referenceWeightKg: 70, now: NOW });

    expect(loud.shouldNotifyUser).toBe(true);
    expect(applyAdaptiveEvaluation(profile, loud).lastNotifiedWeightKg).toBe(70);
  });

  it('ne réancre jamais la base sur un poids déjà réaligné', () => {
    // Profil déjà descendu à 79,4 sans annonce : la base doit rester à 80.
    const profile = buildProfile({ currentWeightKg: 79.4, lastNotifiedWeightKg: 80 });

    const evaluation = evaluateAdaptiveTarget({ profile, referenceWeightKg: 78.8, now: NOW });

    expect(evaluation.notifiedFromWeightKg).toBe(80);
    expect(applyAdaptiveEvaluation(profile, evaluation).lastNotifiedWeightKg).toBe(80);
  });

  it('ne touche à rien quand il n’y a ni réalignement ni notification', () => {
    const profile = buildProfile({ currentWeightKg: 80 });
    const evaluation = evaluateAdaptiveTarget({ profile, referenceWeightKg: 79.9, now: NOW });

    expect(applyAdaptiveEvaluation(profile, evaluation)).toEqual(profile);
  });
});

/**
 * Dérive silencieuse.
 *
 * Le rythme visé étant proportionnel au poids, le déficit se resserre en même
 * temps que la dépense : l'objectif bouge lentement, et un palier de 0,5 kg ne
 * le déplace que de quelques kcal. Comparer chaque recalcul au précédent
 * laisserait donc passer une perte de dix kilos sans jamais franchir le seuil à
 * un pas donné — l'utilisateur mangerait selon un objectif sensiblement
 * différent de celui qu'on lui a annoncé, sans qu'on le lui ait jamais dit.
 */
describe('evaluateAdaptiveTarget — cumul des petits pas', () => {
  /** Rejoue une descente par paliers, comme le ferait une perte régulière. */
  function walkDown(input: { fromKg: number; stepKg: number; steps: number }) {
    let profile = buildProfile({ currentWeightKg: input.fromKg });
    const notifications: number[] = [];

    for (let step = 1; step <= input.steps; step += 1) {
      const referenceWeightKg = Math.round((input.fromKg - step * input.stepKg) * 100) / 100;
      const evaluation = evaluateAdaptiveTarget({ profile, referenceWeightKg, now: NOW });

      if (evaluation.shouldNotifyUser) {
        notifications.push(referenceWeightKg);
      }

      profile = applyAdaptiveEvaluation(profile, evaluation);
    }

    return { profile, notifications };
  }

  it('finit par prévenir, alors qu’aucun pas isolé ne franchit le seuil', () => {
    // Vingt paliers de 0,5 kg : 10 kg au total, ~4 kcal par pas.
    const { notifications } = walkDown({ fromKg: 90, stepKg: 0.5, steps: 20 });

    expect(notifications.length).toBeGreaterThan(0);
  });

  it('ne laisse jamais l’objectif dériver au-delà du seuil sans le dire', () => {
    const { profile, notifications } = walkDown({ fromKg: 90, stepKg: 0.5, steps: 20 });

    // Écart entre l'objectif réellement appliqué et le dernier annoncé.
    const lastNotifiedWeightKg = profile.lastNotifiedWeightKg ?? 90;
    const applied = calculateCalorieTarget(profile, NOW).targetKcal;
    const announced = calculateCalorieTarget(
      { ...profile, currentWeightKg: lastNotifiedWeightKg },
      NOW,
    ).targetKcal;

    expect(notifications.length).toBeGreaterThan(0);
    expect(Math.abs(applied - announced)).toBeLessThan(ADAPTIVE_NOTIFY_THRESHOLD_KCAL);
  });

  it('prévient aussi quand les pas sont trop petits pour réaligner le profil', () => {
    // Des pas de 0,2 kg ne franchissent jamais le seuil de réalignement pris
    // isolément : sans base d'annonce, rien ne serait jamais ni écrit ni dit.
    const { notifications } = walkDown({ fromKg: 90, stepKg: 0.2, steps: 60 });

    expect(notifications.length).toBeGreaterThan(0);
  });

  it('remet le compteur à zéro après chaque annonce', () => {
    const { notifications } = walkDown({ fromKg: 100, stepKg: 0.5, steps: 60 });

    // 30 kg de perte : plusieurs annonces, espacées et non groupées.
    expect(notifications.length).toBeGreaterThan(1);

    const gaps = notifications.slice(1).map((weight, index) => notifications[index] - weight);
    expect(Math.min(...gaps)).toBeGreaterThan(1);
  });

  it('reste silencieux tant que le cumul n’atteint pas le seuil', () => {
    const { notifications } = walkDown({ fromKg: 90, stepKg: 0.5, steps: 4 });

    expect(notifications).toEqual([]);
  });
});
