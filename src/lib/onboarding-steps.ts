import type { GoalType } from '@/domain/profile/types';

/**
 * Enchaînement des écrans d'onboarding.
 *
 * Centralisé ici plutôt que codé en dur dans chaque écran : le parcours dépend
 * de l'objectif choisi, et un écran ne doit pas avoir à connaître cette règle
 * pour savoir où aller ensuite.
 *
 * L'accueil et le consentement sont hors de cette liste : ils précèdent le
 * profilage et ne comptent pas dans la progression affichée.
 */
export type OnboardingStepId =
  | 'goal'
  | 'biometrics'
  | 'target-weight'
  | 'activity'
  | 'sport-habits'
  | 'diet'
  | 'rate'
  | 'summary'
  | 'calorie-mode';

const ALL_STEPS: readonly OnboardingStepId[] = [
  'goal',
  'biometrics',
  'target-weight',
  'activity',
  'sport-habits',
  'diet',
  'rate',
  'summary',
  'calorie-mode',
];

/**
 * Écrans réellement traversés pour un objectif donné.
 *
 * - Pas de poids cible au maintien : il n'y a rien à viser.
 * - Pas de rythme hors perte de poids : la notion n'a pas de sens.
 *
 * Tant que l'objectif n'est pas choisi, on annonce le parcours **le plus long**.
 * La progression affichée peut ainsi raccourcir, jamais s'allonger : découvrir
 * des écrans en cours de route est plus décourageant que d'en voir disparaître.
 */
export function stepsForGoal(goalType: GoalType | undefined): OnboardingStepId[] {
  return ALL_STEPS.filter((step) => {
    if (step === 'target-weight') {
      return goalType !== 'maintenance';
    }
    if (step === 'rate') {
      return goalType === undefined || goalType === 'weight_loss';
    }
    return true;
  });
}

export interface StepProgress {
  step: number;
  total: number;
}

/** Position de l'écran courant, pour la barre de progression. */
export function stepProgress(
  current: OnboardingStepId,
  goalType: GoalType | undefined,
): StepProgress {
  const steps = stepsForGoal(goalType);
  return { step: steps.indexOf(current) + 1, total: steps.length };
}

/** Écran suivant, ou `undefined` si l'onboarding est terminé. */
export function nextStep(
  current: OnboardingStepId,
  goalType: GoalType | undefined,
): OnboardingStepId | undefined {
  const steps = stepsForGoal(goalType);
  return steps[steps.indexOf(current) + 1];
}

/**
 * Type littéral et non `string` : les routes typées d'Expo Router acceptent
 * ainsi la valeur, et un identifiant d'étape inexistant est refusé à la
 * compilation.
 */
export type OnboardingRoute = `/(onboarding)/${OnboardingStepId}`;

export function onboardingRoute(step: OnboardingStepId): OnboardingRoute {
  return `/(onboarding)/${step}`;
}
