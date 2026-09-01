import type { SafetyNoticeKey } from '@/domain/advice/types';
import { calculateCalorieTarget, type CalorieTargetResult } from '@/domain/nutrition/energy';
import type { RiskSignal } from '@/domain/nutrition/safety';
import type { UserProfile } from '@/domain/profile/types';
import { explainAdviceSafety } from '@/lib/messages/advice';
import { explainCalorieTarget } from '@/lib/messages/safety';

import { birthDateForAge, buildProfile, NOW } from '../profile-fixtures';

function targetFor(overrides: Partial<UserProfile> = {}): CalorieTargetResult {
  return calculateCalorieTarget(buildProfile(overrides), NOW);
}

/** Objectif dont le calcul tombe sous le plancher calorique. */
const FLOORED = {
  sex: 'female',
  heightCm: 155,
  currentWeightKg: 50,
  activityLevel: 'sedentary',
  weeklyRateKg: 0.4,
} satisfies Partial<UserProfile>;

/** Objectif menant à une corpulence sous le seuil sain. */
const UNDERWEIGHT = {
  heightCm: 180,
  currentWeightKg: 70,
  targetWeightKg: 55,
} satisfies Partial<UserProfile>;

const ALL_RISK_SIGNALS: RiskSignal[] = [
  'repeated_sub_floor_targets',
  'repeatedly_lowered_target_weight',
  'persistent_maximum_rate',
  'underweight_target_requested',
];

describe('explainAdviceSafety — réutilisation des textes existants', () => {
  /**
   * Le point central de la décision d'architecture : le moteur ne réécrit
   * aucune mise en garde déjà rédigée pour l'onboarding.
   */
  it('reprend mot pour mot l’explication du plancher calorique', () => {
    const target = targetFor(FLOORED);
    const [fromAdvice] = explainAdviceSafety({ notices: ['floor_applied'], target });
    const fromOnboarding = explainCalorieTarget(target).find(({ id }) =>
      id.startsWith('floor_applied'),
    );

    expect(fromAdvice).toEqual(fromOnboarding);
  });

  it('reprend mot pour mot l’explication du poids cible trop bas', () => {
    const target = targetFor(UNDERWEIGHT);
    const [fromAdvice] = explainAdviceSafety({ notices: ['goal_leads_to_underweight'], target });
    const fromOnboarding = explainCalorieTarget(target).find(
      ({ id }) => id === 'goal_leads_to_underweight',
    );

    expect(fromAdvice).toEqual(fromOnboarding);
  });

  it('choisit la bonne variante de plancher selon la dépense estimée', () => {
    // Le plancher peut placer l'objectif **au-dessus** de la dépense : cette
    // variante-là a son propre texte, et c'est celle qui doit sortir.
    // Femme âgée, très légère et sédentaire : sa dépense estimée passe elle-même
    // sous le plancher, qui relève donc l'objectif au-dessus d'elle.
    const target = targetFor({
      sex: 'female',
      heightCm: 150,
      currentWeightKg: 40,
      birthDate: birthDateForAge(60),
      activityLevel: 'sedentary',
      goalType: 'maintenance',
      weeklyRateKg: undefined,
    });

    expect(target.appliedDeficitKcal).toBeLessThan(0);
    expect(explainAdviceSafety({ notices: ['floor_applied'], target })[0].id).toBe(
      'floor_applied_above_expenditure',
    );
  });
});

describe('explainAdviceSafety — signaux de risque', () => {
  it.each(ALL_RISK_SIGNALS)('produit un message pour « %s »', (signal) => {
    const [explanation] = explainAdviceSafety({ notices: [signal], target: targetFor() });

    expect(explanation).toBeDefined();
    expect(explanation.title.length).toBeGreaterThan(0);
    expect(explanation.body.length).toBeGreaterThan(80);
    // Un signal de risque n'est jamais une remarque anodine.
    expect(explanation.tone).toBe('caution');
  });

  it.each(ALL_RISK_SIGNALS)('oriente « %s » vers un professionnel de santé', (signal) => {
    const [explanation] = explainAdviceSafety({ notices: [signal], target: targetFor() });

    expect(explanation.body).toMatch(/médecin|diététicien|professionnel de santé/);
  });

  it.each(ALL_RISK_SIGNALS)('n’encourage jamais l’objectif dans « %s »', (signal) => {
    const [explanation] = explainAdviceSafety({ notices: [signal], target: targetFor() });
    const text = `${explanation.title} ${explanation.body}`.toLowerCase();

    for (const phrase of ['continue comme ça', 'bravo', 'tu peux y arriver', 'accroche-toi']) {
      expect(text).not.toContain(phrase);
    }
  });

  it('donne un identifiant distinct à chaque signal', () => {
    const ids = ALL_RISK_SIGNALS.map(
      (signal) => explainAdviceSafety({ notices: [signal], target: targetFor() })[0].id,
    );

    expect(new Set(ids).size).toBe(ALL_RISK_SIGNALS.length);
  });
});

describe('explainAdviceSafety — assemblage', () => {
  it('respecte l’ordre décidé par le domaine', () => {
    const notices: SafetyNoticeKey[] = ['goal_leads_to_underweight', 'persistent_maximum_rate'];
    const ids = explainAdviceSafety({ notices, target: targetFor(UNDERWEIGHT) }).map(
      ({ id }) => id,
    );

    expect(ids).toEqual(['goal_leads_to_underweight', 'risk_persistent_maximum_rate']);
  });

  it('ne renvoie rien quand aucun garde-fou n’est signalé', () => {
    expect(explainAdviceSafety({ notices: [], target: targetFor() })).toEqual([]);
  });

  it('ignore un drapeau que l’objectif ne porte pas, plutôt que d’inventer un message', () => {
    // Appel incohérent : le domaine ne le produit pas, mais rien ne doit
    // afficher une mise en garde sans fondement.
    expect(explainAdviceSafety({ notices: ['floor_applied'], target: targetFor() })).toEqual([]);
    expect(
      explainAdviceSafety({ notices: ['goal_leads_to_underweight'], target: targetFor() }),
    ).toEqual([]);
  });

  it('mélange sans peine garde-fous de calcul et signaux comportementaux', () => {
    const ids = explainAdviceSafety({
      notices: ['goal_leads_to_underweight', 'repeated_sub_floor_targets', 'floor_applied'],
      target: targetFor({ ...FLOORED, targetWeightKg: 40 }),
    }).map(({ id }) => id);

    expect(ids).toEqual([
      'goal_leads_to_underweight',
      'risk_repeated_sub_floor_targets',
      'floor_applied',
    ]);
  });
});
