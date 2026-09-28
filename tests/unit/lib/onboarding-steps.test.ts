import {
  nextStep,
  onboardingRoute,
  stepProgress,
  stepsForGoal,
  type OnboardingStepId,
} from '@/lib/onboarding-steps';

describe('stepsForGoal', () => {
  it('traverse tous les écrans en perte de poids', () => {
    expect(stepsForGoal('weight_loss')).toEqual([
      'goal',
      'biometrics',
      'target-weight',
      'activity',
      'sport-habits',
      'diet',
      'rate',
      'summary',
      'calorie-mode',
    ]);
  });

  it('saute le rythme en recomposition : la notion n’a pas de sens', () => {
    const steps = stepsForGoal('recomposition');

    expect(steps).not.toContain('rate');
    expect(steps).toContain('target-weight');
  });

  it('saute le poids cible et le rythme au maintien', () => {
    const steps = stepsForGoal('maintenance');

    expect(steps).not.toContain('target-weight');
    expect(steps).not.toContain('rate');
  });

  it('propose le parcours complet tant que l’objectif n’est pas choisi', () => {
    expect(stepsForGoal(undefined)).toHaveLength(9);
  });

  it('commence toujours par l’objectif et finit par le mode calories', () => {
    for (const goalType of ['weight_loss', 'recomposition', 'maintenance', undefined] as const) {
      const steps = stepsForGoal(goalType);

      expect(steps[0]).toBe('goal');
      expect(steps[steps.length - 1]).toBe('calorie-mode');
      expect(steps).toContain('summary');
    }
  });
});

describe('nextStep', () => {
  it('enchaîne l’objectif sur la biométrie, avant tout contrôle d’IMC', () => {
    expect(nextStep('goal', 'weight_loss')).toBe('biometrics');
  });

  it('saute le poids cible au maintien', () => {
    expect(nextStep('biometrics', 'maintenance')).toBe('activity');
    expect(nextStep('biometrics', 'weight_loss')).toBe('target-weight');
  });

  it('saute le rythme hors perte de poids', () => {
    expect(nextStep('diet', 'weight_loss')).toBe('rate');
    expect(nextStep('diet', 'recomposition')).toBe('summary');
    expect(nextStep('diet', 'maintenance')).toBe('summary');
  });

  it('n’a plus rien après le dernier écran', () => {
    expect(nextStep('calorie-mode', 'weight_loss')).toBeUndefined();
  });

  it('atteint le dernier écran depuis le premier, quel que soit l’objectif', () => {
    for (const goalType of ['weight_loss', 'recomposition', 'maintenance'] as const) {
      let current: OnboardingStepId | undefined = 'goal';
      const visited: OnboardingStepId[] = [];

      while (current) {
        visited.push(current);
        current = nextStep(current, goalType);
      }

      expect(visited).toEqual(stepsForGoal(goalType));
    }
  });
});

describe('stepProgress', () => {
  it('numérote à partir de 1', () => {
    expect(stepProgress('goal', 'weight_loss')).toEqual({ step: 1, total: 9 });
  });

  it('raccourcit le parcours au maintien', () => {
    expect(stepProgress('goal', 'maintenance')).toEqual({ step: 1, total: 7 });
    expect(stepProgress('calorie-mode', 'maintenance')).toEqual({ step: 7, total: 7 });
  });

  it('ne dépasse jamais le total', () => {
    for (const goalType of ['weight_loss', 'recomposition', 'maintenance'] as const) {
      for (const step of stepsForGoal(goalType)) {
        const progress = stepProgress(step, goalType);

        expect(progress.step).toBeGreaterThanOrEqual(1);
        expect(progress.step).toBeLessThanOrEqual(progress.total);
      }
    }
  });
});

describe('onboardingRoute', () => {
  it('construit le chemin du groupe d’onboarding', () => {
    expect(onboardingRoute('summary')).toBe('/(onboarding)/summary');
  });

  it('couvre toutes les étapes', () => {
    for (const step of stepsForGoal(undefined)) {
      expect(onboardingRoute(step)).toBe(`/(onboarding)/${step}`);
    }
  });
});
