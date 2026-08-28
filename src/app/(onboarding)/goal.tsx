import { useRouter } from 'expo-router';

import { StepScreen } from '@/components/onboarding/step-screen';
import { OptionCard } from '@/components/ui';
import { useOnboarding } from '@/hooks/use-onboarding';
import type { GoalType } from '@/domain/profile/types';
import { nextStep, onboardingRoute, stepProgress } from '@/lib/onboarding-steps';

const GOALS: { value: GoalType; label: string; description: string }[] = [
  {
    value: 'weight_loss',
    label: 'Perdre du poids',
    description: 'Réduire la masse grasse en préservant le muscle, à un rythme tenable.',
  },
  {
    value: 'recomposition',
    label: 'Me recomposer',
    description:
      'Rester autour de mon poids en gagnant du muscle et en perdant du gras. Priorité aux protéines et à la musculation.',
  },
  {
    value: 'maintenance',
    label: 'Maintenir mon poids',
    description: 'Stabiliser, comprendre mes besoins et garder de bonnes habitudes.',
  },
];

/** Écran 3 — objectif. Premier choix qui oriente tout le reste du parcours. */
export default function GoalScreen() {
  const router = useRouter();
  const { draft, update } = useOnboarding();

  const goToNext = (goalType: GoalType) => {
    update({ goalType });
    const next = nextStep('goal', goalType);

    if (next) {
      router.push(onboardingRoute(next));
    }
  };

  return (
    <StepScreen
      testID="onboarding-goal"
      title="Quel est ton objectif ?"
      subtitle="Tu pourras en changer plus tard depuis les réglages."
      progress={stepProgress('goal', draft.goalType)}
      primaryLabel="Continuer"
      primaryDisabled={draft.goalType === undefined}
      onPrimary={() => draft.goalType && goToNext(draft.goalType)}
    >
      {GOALS.map((goal) => (
        <OptionCard
          key={goal.value}
          testID={`goal-${goal.value}`}
          label={goal.label}
          description={goal.description}
          selected={draft.goalType === goal.value}
          onPress={() => update({ goalType: goal.value })}
        />
      ))}
    </StepScreen>
  );
}
