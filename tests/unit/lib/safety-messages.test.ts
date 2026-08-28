import { calculateCalorieTarget, type CalorieTargetResult } from '@/domain/nutrition/energy';
import { calculateMacros } from '@/domain/nutrition/macros';
import type { SafetyAdjustment, SafetyWarning } from '@/domain/nutrition/safety';
import { formatKcal, formatWeeklyRate } from '@/lib/format';
import {
  CALORIE_MODE_EXPLANATIONS,
  CONSENT_POINTS,
  explainCalorieTarget,
  explainMacros,
  SEX_FIELD_NOTE,
  WARNINGS_COVERED_BY_ADJUSTMENT,
} from '@/lib/messages/safety';

import { birthDateForAge, buildProfile, NOW } from '../profile-fixtures';

/**
 * Ces tests verrouillent la règle la plus importante de la restitution :
 * aucun garde-fou déclenché ne peut rester muet.
 */
describe('explainCalorieTarget', () => {
  it('ne dit rien quand rien n’a été ajusté', () => {
    const result = calculateCalorieTarget(buildProfile(), NOW);

    expect(result.adjustments).toEqual([]);
    expect(explainCalorieTarget(result)).toEqual([]);
  });

  it('explique un rythme plafonné, avec le rythme réellement retenu', () => {
    const result = calculateCalorieTarget(
      buildProfile({ currentWeightKg: 90, weeklyRateKg: 2 }),
      NOW,
    );
    const explanations = explainCalorieTarget(result);

    expect(explanations.map((entry) => entry.id)).toContain('rate_capped');
    expect(explanations[0]?.body).toContain(formatWeeklyRate(result.effectiveWeeklyRateKg));
  });

  it('explique un déficit plafonné', () => {
    const result = calculateCalorieTarget(buildProfile({ currentWeightKg: 120 }), NOW);

    expect(explainCalorieTarget(result).map((entry) => entry.id)).toContain('deficit_capped');
  });

  it('explique un plancher appliqué en perte de poids', () => {
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
    const floor = explainCalorieTarget(result).find((entry) => entry.id === 'floor_applied');

    expect(result.adjustments).toContain('floor_applied');
    expect(floor).toBeDefined();
    expect(floor?.body).toContain(formatKcal(1200));
  });

  describe('objectif au-dessus de la dépense estimée', () => {
    /**
     * Le cas le plus déroutant : au maintien, le plancher peut placer l'objectif
     * au-dessus du TDEE. Sans explication, l'utilisateur croit à un bug.
     */
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

    it('est bien le cas testé', () => {
      expect(result.appliedDeficitKcal).toBeLessThan(0);
      expect(result.targetKcal).toBeGreaterThan(result.tdeeKcal);
    });

    it('utilise un message dédié, pas celui de la perte de poids', () => {
      const ids = explainCalorieTarget(result).map((entry) => entry.id);

      expect(ids).toContain('floor_applied_above_expenditure');
      expect(ids).not.toContain('floor_applied');
    });

    it('dit explicitement que c’est volontaire et pourquoi', () => {
      const explanation = explainCalorieTarget(result).find(
        (entry) => entry.id === 'floor_applied_above_expenditure',
      );

      expect(explanation?.title).toMatch(/volontairement/);
      expect(explanation?.body).toContain('c’est voulu');
      expect(explanation?.body).toMatch(/zone sûre|sûre pour ta santé/);
      expect(explanation?.body).toContain('professionnel de santé');
    });

    it('cite les deux chiffres qui semblent se contredire', () => {
      const explanation = explainCalorieTarget(result).find(
        (entry) => entry.id === 'floor_applied_above_expenditure',
      );

      expect(explanation?.body).toContain(formatKcal(result.tdeeKcal));
      expect(explanation?.body).toContain(formatKcal(result.targetKcal));
    });
  });

  it('signale un poids cible sous le seuil sain sans le renforcer', () => {
    const result = calculateCalorieTarget(buildProfile({ heightCm: 170, targetWeightKg: 49 }), NOW);
    const explanation = explainCalorieTarget(result).find(
      (entry) => entry.id === 'goal_leads_to_underweight',
    );

    expect(explanation).toBeDefined();
    expect(explanation?.tone).toBe('caution');
    expect(explanation?.body).toMatch(/médecin|diététicien/);
    // Aucun encouragement : pas de félicitation, pas d'objectif validé.
    expect(explanation?.body).not.toMatch(/bravo|félicitations|excellent/i);
  });
});

describe('invariant : aucun ajustement ni avertissement silencieux', () => {
  const sexes = ['male', 'female'] as const;
  const goals = ['weight_loss', 'recomposition', 'maintenance'] as const;
  const activityLevels = ['sedentary', 'moderately_active', 'extremely_active'] as const;
  const weights = [25, 42, 50, 80, 120, 250];
  const heights = [150, 170, 190];
  const ages = [18, 40, 75];
  const rates: (number | undefined)[] = [undefined, 0.3, 2];
  const targets: (number | undefined)[] = [undefined, 45];

  function collect(): CalorieTargetResult[] {
    const results: CalorieTargetResult[] = [];

    for (const sex of sexes) {
      for (const goalType of goals) {
        for (const activityLevel of activityLevels) {
          for (const currentWeightKg of weights) {
            for (const heightCm of heights) {
              for (const ageYears of ages) {
                for (const weeklyRateKg of rates) {
                  for (const targetWeightKg of targets) {
                    results.push(
                      calculateCalorieTarget(
                        buildProfile({
                          sex,
                          goalType,
                          activityLevel,
                          currentWeightKg,
                          heightCm,
                          birthDate: birthDateForAge(ageYears),
                          weeklyRateKg,
                          targetWeightKg,
                        }),
                        NOW,
                      ),
                    );
                  }
                }
              }
            }
          }
        }
      }
    }

    return results;
  }

  const results = collect();

  it('produit au moins un message dès qu’un garde-fou s’est déclenché', () => {
    for (const result of results) {
      const hasFlag = result.adjustments.length > 0 || result.warnings.length > 0;

      if (hasFlag) {
        expect(explainCalorieTarget(result).length).toBeGreaterThan(0);
      }
    }
  });

  it('représente chaque ajustement par un message', () => {
    for (const result of results) {
      const ids = explainCalorieTarget(result).map((entry) => entry.id);

      for (const adjustment of result.adjustments) {
        const isRepresented =
          ids.includes(adjustment) ||
          // Le plancher a deux formulations selon le sens de l'écart.
          (adjustment === 'floor_applied' && ids.includes('floor_applied_above_expenditure'));

        expect(isRepresented).toBe(true);
      }
    }
  });

  it('représente chaque avertissement, directement ou via son ajustement', () => {
    for (const result of results) {
      const ids = explainCalorieTarget(result).map((entry) => entry.id);

      for (const warning of result.warnings) {
        const covering = (
          WARNINGS_COVERED_BY_ADJUSTMENT as Record<SafetyWarning, SafetyAdjustment | undefined>
        )[warning];

        const isRepresented =
          ids.includes(warning) ||
          (covering !== undefined && result.adjustments.includes(covering));

        expect(isRepresented).toBe(true);
      }
    }
  });

  it('ne produit jamais deux fois le même message', () => {
    for (const result of results) {
      const ids = explainCalorieTarget(result).map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('ne laisse jamais un corps de message vide', () => {
    for (const result of results) {
      for (const explanation of explainCalorieTarget(result)) {
        expect(explanation.title.length).toBeGreaterThan(0);
        expect(explanation.body.length).toBeGreaterThan(30);
      }
    }
  });
});

describe('explainMacros', () => {
  it('ne dit rien sur une répartition standard', () => {
    const macros = calculateMacros({ targetKcal: 2099, weightKg: 80, goalType: 'weight_loss' });

    expect(explainMacros(macros)).toEqual([]);
  });

  it('explique une réduction des protéines', () => {
    const macros = calculateMacros({ targetKcal: 1300, weightKg: 100, goalType: 'weight_loss' });
    const explanations = explainMacros(macros);

    expect(explanations.map((entry) => entry.id)).toEqual(['protein_reduced']);
    expect(explanations[0]?.body).toMatch(/lipides/);
  });

  it('alerte quand même les planchers ne tiennent pas', () => {
    const macros = calculateMacros({ targetKcal: 1200, weightKg: 150, goalType: 'weight_loss' });
    const explanations = explainMacros(macros);

    expect(explanations[0]?.id).toBe('macro_floors_unreachable');
    expect(explanations[0]?.tone).toBe('caution');
    expect(explanations[0]?.body).toContain('professionnel de santé');
  });
});

describe('contenus fixes', () => {
  it('explique les deux modes de calories sport', () => {
    expect(CALORIE_MODE_EXPLANATIONS.fixed_mode.body).toMatch(/n’augmente pas|ne bouge pas/);
    expect(CALORIE_MODE_EXPLANATIONS.credited_mode.body).toMatch(/s’ajoutent/);
    // Le mode par défaut est justifié, pas imposé sans raison.
    expect(CALORIE_MODE_EXPLANATIONS.fixed_mode.body).toMatch(/surév|généreuses/);
  });

  it('explique l’usage strictement métabolique du champ sexe', () => {
    expect(SEX_FIELD_NOTE).toMatch(/sexe biologique/);
    expect(SEX_FIELD_NOTE).toMatch(/identité de genre/);
  });

  it('couvre les quatre points exigés avant toute collecte', () => {
    const joined = CONSENT_POINTS.join(' ');

    expect(joined).toMatch(/collectées|collecte/i);
    expect(joined).toMatch(/personnaliser|calculer/);
    expect(joined).toMatch(/appareil/);
    expect(joined).toMatch(/supprimer/);
  });
});
