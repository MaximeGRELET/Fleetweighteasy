import { useRouter } from 'expo-router';

import { StepScreen } from '@/components/onboarding/step-screen';
import { OptionCard, Text } from '@/components/ui';
import type { ActivityLevel } from '@/domain/profile/types';
import { useOnboarding } from '@/hooks/use-onboarding';
import { nextStep, onboardingRoute, stepProgress } from '@/lib/onboarding-steps';

/**
 * Les libellés décrivent des situations concrètes, pas des étiquettes abstraites :
 * c'est le seul moyen d'obtenir un choix honnête, et ce facteur pèse lourd dans
 * le calcul de la dépense.
 */
const LEVELS: { value: ActivityLevel; label: string; description: string }[] = [
  {
    value: 'sedentary',
    label: 'Sédentaire',
    description: 'Travail assis, peu de marche, pas de sport régulier.',
  },
  {
    value: 'lightly_active',
    label: 'Légèrement actif',
    description: 'Un peu de marche au quotidien, ou 1 à 2 séances par semaine.',
  },
  {
    value: 'moderately_active',
    label: 'Modérément actif',
    description: 'Debout une partie de la journée, ou 3 à 5 séances par semaine.',
  },
  {
    value: 'very_active',
    label: 'Très actif',
    description: 'Métier physique, ou 6 à 7 séances par semaine.',
  },
  {
    value: 'extremely_active',
    label: 'Extrêmement actif',
    description: 'Travail de force quotidien, ou entraînement biquotidien.',
  },
];

/** Écran 6 — niveau d'activité habituel. */
export default function ActivityScreen() {
  const router = useRouter();
  const { draft, update } = useOnboarding();

  return (
    <StepScreen
      testID="onboarding-activity"
      title="À quoi ressemblent tes journées ?"
      subtitle="Choisis ce qui décrit le mieux ton activité habituelle, sport compris."
      progress={stepProgress('activity', draft.goalType)}
      primaryLabel="Continuer"
      primaryDisabled={draft.activityLevel === undefined}
      onPrimary={() => {
        const next = nextStep('activity', draft.goalType);
        if (next) {
          router.push(onboardingRoute(next));
        }
      }}
    >
      {LEVELS.map((level) => (
        <OptionCard
          key={level.value}
          testID={`activity-${level.value}`}
          label={level.label}
          description={level.description}
          selected={draft.activityLevel === level.value}
          onPress={() => update({ activityLevel: level.value })}
        />
      ))}

      <Text variant="caption" tone="textMuted">
        Ce niveau inclut déjà ton sport habituel. C’est pour cela que, par défaut, les séances
        ponctuelles n’augmentent pas ton budget calorique du jour.
      </Text>
    </StepScreen>
  );
}
