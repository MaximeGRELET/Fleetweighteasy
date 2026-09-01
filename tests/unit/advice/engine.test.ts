import { selectAdvice, selectBlocks } from '@/domain/advice/engine';
import { calculateCalorieTarget, type CalorieTargetResult } from '@/domain/nutrition/energy';
import type { UserProfile } from '@/domain/profile/types';

import { buildProfile, NOW } from '../profile-fixtures';

import { buildContext } from './advice-fixtures';

/** Objectif calorique réel, pour éprouver la bande de sécurité sur de vrais drapeaux. */
function targetFor(overrides: Partial<UserProfile>): CalorieTargetResult {
  return calculateCalorieTarget(buildProfile(overrides), NOW);
}

const ids = (blocks: readonly { id: string }[]) => blocks.map((block) => block.id);

describe('selectBlocks — filtrage par profil', () => {
  it('ne retient que les briques dont tous les tags correspondent', () => {
    const selected = ids(
      selectBlocks(buildProfile({ goalType: 'weight_loss', dietType: 'vegan' }), buildContext()),
    );

    expect(selected).toContain('protein__vegan');
    expect(selected).not.toContain('protein__omnivore');
    expect(selected).not.toContain('protein__vegetarian');
  });

  it('adapte le conseil protéines au régime', () => {
    const proteinFor = (dietType: UserProfile['dietType']) =>
      selectBlocks(buildProfile({ dietType }), buildContext()).find(
        (block) => block.topic === 'protein',
      )?.id;

    expect(proteinFor('omnivore')).toBe('protein__omnivore');
    expect(proteinFor('vegetarian')).toBe('protein__vegetarian');
    expect(proteinFor('vegan')).toBe('protein__vegan');
  });

  it('ne propose aucune brique protéines à un régime sans variante dédiée', () => {
    // Flexitarien en perte : aucune brique ne le cible, et on préfère ne rien
    // dire plutôt que de servir un texte pensé pour quelqu'un d'autre.
    const selected = selectBlocks(buildProfile({ dietType: 'flexitarian' }), buildContext());

    expect(selected.some((block) => block.topic === 'protein')).toBe(false);
  });

  it('distingue les briques d’objectif', () => {
    const lossIds = ids(selectBlocks(buildProfile({ goalType: 'weight_loss' }), buildContext()));
    const recompIds = ids(
      selectBlocks(buildProfile({ goalType: 'recomposition' }), buildContext()),
    );

    expect(lossIds).toContain('understanding_deficit__weight_loss');
    expect(lossIds).not.toContain('recomposition__default');
    expect(recompIds).toContain('recomposition__default');
    expect(recompIds).not.toContain('understanding_deficit__weight_loss');
  });

  it('ne garde que les briques universelles pour un objectif de maintien', () => {
    const selected = ids(selectBlocks(buildProfile({ goalType: 'maintenance' }), buildContext()));

    expect(selected).toContain('hydration__default');
    expect(selected).toContain('sleep__default');
    // Les conseils déficit, faim, alcool et week-ends ciblent la perte.
    expect(selected).not.toContain('alcohol__default');
    expect(selected).not.toContain('hunger_satiety__default');
  });
});

describe('selectBlocks — un seul texte par topic', () => {
  it('tranche entre deux briques du même topic par la priorité', () => {
    // Quelqu'un qui court et soulève est candidat aux deux briques de
    // `resistance_training` : la plus prioritaire l'emporte.
    const profile = buildProfile({
      goalType: 'weight_loss',
      sportProfile: {
        practices: ['strength', 'cardio'],
        strengthEnvironments: ['gym'],
        cardioActivities: ['running'],
      },
    });

    const selected = ids(selectBlocks(profile, buildContext()));

    expect(selected).toContain('resistance_training__weight_loss');
    expect(selected).not.toContain('resistance_training__encourage');
  });

  it('propose d’ajouter de la résistance à qui ne fait que du cardio', () => {
    const profile = buildProfile({
      goalType: 'weight_loss',
      sportProfile: {
        practices: ['cardio'],
        strengthEnvironments: [],
        cardioActivities: ['running'],
      },
    });

    expect(ids(selectBlocks(profile, buildContext()))).toContain('resistance_training__encourage');
  });

  it('n’expose jamais deux briques du même topic', () => {
    const profile = buildProfile({
      goalType: 'weight_loss',
      sportProfile: {
        practices: ['strength', 'cardio'],
        strengthEnvironments: ['gym'],
        cardioActivities: ['running'],
      },
    });

    const topics = selectBlocks(profile, buildContext({ hasWeighedThisWeek: false })).map(
      (block) => block.topic,
    );

    expect(new Set(topics).size).toBe(topics.length);
  });

  it('remplace le conseil général de pesée par le rappel quand il s’applique', () => {
    const weighing = (hasWeighedThisWeek: boolean) =>
      selectBlocks(buildProfile(), buildContext({ hasWeighedThisWeek })).find(
        (block) => block.topic === 'weighing_fluctuations',
      )?.id;

    expect(weighing(true)).toBe('weighing_fluctuations__default');
    expect(weighing(false)).toBe('weighing_fluctuations__reminder');
  });
});

describe('selectBlocks — conditions contextuelles', () => {
  it('accueille un nouvel utilisateur, et lui seul', () => {
    expect(ids(selectBlocks(buildProfile(), buildContext({ isNewUser: true })))).toContain(
      'getting_started__default',
    );
    expect(ids(selectBlocks(buildProfile(), buildContext({ isNewUser: false })))).not.toContain(
      'getting_started__default',
    );
  });

  it('déclenche la reprise après écart sur détection', () => {
    expect(ids(selectBlocks(buildProfile(), buildContext({ recentSlipDetected: true })))).toContain(
      'recovery_after_slip__default',
    );
    expect(
      ids(selectBlocks(buildProfile(), buildContext({ recentSlipDetected: false }))),
    ).not.toContain('recovery_after_slip__default');
  });

  /**
   * Le plateau appartient à l'écran de suivi du poids, qui l'explique déjà avec
   * le nombre de semaines à l'appui (Phase 5). Le moteur s'abstient pour que la
   * même chose ne soit pas dite deux fois le même jour.
   */
  it('laisse le plateau à l’écran de suivi du poids', () => {
    const selected = selectBlocks(buildProfile(), buildContext({ plateauDetected: true }));

    expect(ids(selected)).not.toContain('plateau__default');
    expect(selected.some((block) => block.topic === 'plateau')).toBe(false);
  });
});

describe('selectBlocks — ordre', () => {
  it('trie par priorité décroissante', () => {
    const priorities = selectBlocks(buildProfile(), buildContext()).map((block) => block.priority);

    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
  });

  it('est déterministe : mêmes entrées, même résultat', () => {
    const profile = buildProfile();
    const context = buildContext({ isNewUser: true, recentSlipDetected: true });

    expect(selectBlocks(profile, context)).toEqual(selectBlocks(profile, context));
  });

  it('met l’accueil devant tout le reste pour un nouvel utilisateur', () => {
    const selected = selectBlocks(buildProfile(), buildContext({ isNewUser: true }));

    expect(selected[0]?.id).toBe('getting_started__default');
  });

  it('fait passer un écart récent devant les conseils généraux', () => {
    const selected = selectBlocks(
      buildProfile(),
      buildContext({ isNewUser: false, recentSlipDetected: true }),
    );

    expect(selected[0]?.id).toBe('recovery_after_slip__default');
  });

  it('fait passer l’accueil devant l’écart récent', () => {
    // Les deux peuvent coexister ; les priorités du contenu tranchent (100 > 85).
    const selected = selectBlocks(
      buildProfile(),
      buildContext({ isNewUser: true, recentSlipDetected: true }),
    );

    expect(ids(selected).slice(0, 2)).toEqual([
      'getting_started__default',
      'recovery_after_slip__default',
    ]);
  });
});

describe('selectAdvice — bande de sécurité', () => {
  it('n’expose aucun garde-fou quand aucun n’est actif', () => {
    const selection = selectAdvice({
      profile: buildProfile(),
      context: buildContext(),
      safety: { target: targetFor({}) },
    });

    expect(selection.safety).toEqual([]);
    expect(selection.featured).toBeDefined();
  });

  it('n’expose aucun garde-fou quand l’appelant n’en fournit pas', () => {
    const selection = selectAdvice({ profile: buildProfile(), context: buildContext() });

    expect(selection.safety).toEqual([]);
    expect(selection.featured).toBeDefined();
  });

  it('signale un plancher calorique appliqué', () => {
    // Femme légère et sédentaire : le calcul tombe sous le plancher.
    const target = targetFor({
      sex: 'female',
      heightCm: 155,
      currentWeightKg: 50,
      activityLevel: 'sedentary',
      weeklyRateKg: 0.4,
    });

    expect(target.adjustments).toContain('floor_applied');

    const selection = selectAdvice({
      profile: buildProfile(),
      context: buildContext(),
      safety: { target },
    });

    expect(selection.safety).toContain('floor_applied');
  });

  it('signale un poids cible menant à l’insuffisance pondérale', () => {
    const target = targetFor({ heightCm: 180, currentWeightKg: 70, targetWeightKg: 55 });

    expect(target.warnings).toContain('goal_leads_to_underweight');
    expect(
      selectAdvice({ profile: buildProfile(), context: buildContext(), safety: { target } }).safety,
    ).toContain('goal_leads_to_underweight');
  });

  it('cède le conseil du jour au garde-fou', () => {
    const selection = selectAdvice({
      profile: buildProfile(),
      context: buildContext(),
      safety: { target: targetFor({ heightCm: 180, currentWeightKg: 70, targetWeightKg: 55 }) },
    });

    // Une mise en garde de santé ne passe pas derrière un conseil sur le sommeil.
    expect(selection.featured).toBeUndefined();
    expect(selection.safety.length).toBeGreaterThan(0);
  });

  it('garde les briques accessibles sous le garde-fou', () => {
    const selection = selectAdvice({
      profile: buildProfile(),
      context: buildContext(),
      safety: { target: targetFor({ heightCm: 180, currentWeightKg: 70, targetWeightKg: 55 }) },
    });

    // Les briques protectrices — faim, reprise après écart — restent lisibles :
    // les supprimer priverait la personne du contenu le plus utile.
    expect(selection.blocks.length).toBeGreaterThan(0);
  });

  it('remonte les signaux de risque fournis par l’appelant', () => {
    const selection = selectAdvice({
      profile: buildProfile(),
      context: buildContext(),
      safety: {
        target: targetFor({}),
        riskSignals: ['persistent_maximum_rate', 'repeated_sub_floor_targets'],
      },
    });

    expect(selection.safety).toEqual(['repeated_sub_floor_targets', 'persistent_maximum_rate']);
  });

  it('classe les garde-fous par gravité, pas par ordre d’arrivée', () => {
    const selection = selectAdvice({
      profile: buildProfile(),
      context: buildContext(),
      safety: {
        target: targetFor({
          sex: 'female',
          heightCm: 155,
          currentWeightKg: 50,
          activityLevel: 'sedentary',
          weeklyRateKg: 0.4,
          targetWeightKg: 40,
        }),
        riskSignals: ['persistent_maximum_rate'],
      },
    });

    // Un objectif dangereux passe devant un schéma de réglage, lui-même devant
    // l'annonce d'une protection déjà appliquée.
    expect(selection.safety).toEqual([
      'goal_leads_to_underweight',
      'persistent_maximum_rate',
      'floor_applied',
    ]);
  });

  it('ne dit pas deux fois la même chose sur un objectif sous le seuil sain', () => {
    // `underweight_target_requested` est l'écho historique de
    // `goal_leads_to_underweight` : afficher les deux ferait doublon.
    const selection = selectAdvice({
      profile: buildProfile(),
      context: buildContext(),
      safety: {
        target: targetFor({ heightCm: 180, currentWeightKg: 70, targetWeightKg: 55 }),
        riskSignals: ['underweight_target_requested'],
      },
    });

    expect(selection.safety).toEqual(['goal_leads_to_underweight']);
  });

  it('conserve le signal historique quand l’objectif courant est redevenu sain', () => {
    const selection = selectAdvice({
      profile: buildProfile(),
      context: buildContext(),
      safety: {
        target: targetFor({ heightCm: 180, currentWeightKg: 80, targetWeightKg: 75 }),
        riskSignals: ['underweight_target_requested'],
      },
    });

    expect(selection.safety).toEqual(['underweight_target_requested']);
  });

  it('ne répète pas les garde-fous ponctuels déjà expliqués au réglage', () => {
    // Rythme et déficit plafonnés commentent une décision que l'utilisateur
    // vient de prendre : les rappeler chaque jour serait du harcèlement.
    const target = targetFor({ currentWeightKg: 80, weeklyRateKg: 2 });

    expect(target.adjustments).toEqual(expect.arrayContaining(['rate_capped', 'deficit_capped']));
    expect(
      selectAdvice({ profile: buildProfile(), context: buildContext(), safety: { target } }).safety,
    ).toEqual([]);
  });

  it('reste déterministe, bande de sécurité comprise', () => {
    const input = {
      profile: buildProfile(),
      context: buildContext({ recentSlipDetected: true }),
      safety: {
        target: targetFor({ heightCm: 180, currentWeightKg: 70, targetWeightKg: 55 }),
        riskSignals: ['persistent_maximum_rate' as const],
      },
    };

    expect(selectAdvice(input)).toEqual(selectAdvice(input));
  });
});
