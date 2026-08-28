import { useRouter } from 'expo-router';

import { StepScreen } from '@/components/onboarding/step-screen';
import { OptionCard, Text } from '@/components/ui';
import { DEFAULT_CALORIE_MODE, type CalorieMode } from '@/domain/profile/types';
import { useOnboarding } from '@/hooks/use-onboarding';
import { CALORIE_MODE_EXPLANATIONS } from '@/lib/messages/safety';
import { stepProgress } from '@/lib/onboarding-steps';

const MODES: { value: CalorieMode; explanationKey: 'fixed_mode' | 'credited_mode' }[] = [
  { value: 'fixed', explanationKey: 'fixed_mode' },
  { value: 'credited', explanationKey: 'credited_mode' },
];

/**
 * Écran 11 — mode de gestion des calories sport, puis entrée dans l'app.
 *
 * `fixed` est le défaut et il est signalé comme recommandé, mais les deux options
 * sont expliquées honnêtement : c'est un choix de l'utilisateur, pas une case
 * qu'on lui force.
 */
export default function CalorieModeScreen() {
  const router = useRouter();
  const { draft, update, complete } = useOnboarding();

  return (
    <StepScreen
      testID="onboarding-calorie-mode"
      title="Et le sport dans tout ça ?"
      subtitle="Deux façons de traiter les calories brûlées à l’entraînement. Tu pourras changer d’avis dans les réglages."
      progress={stepProgress('calorie-mode', draft.goalType)}
      primaryLabel="Terminer"
      onPrimary={() => {
        complete();
        router.replace('/');
      }}
    >
      {MODES.map((mode) => {
        const explanation = CALORIE_MODE_EXPLANATIONS[mode.explanationKey];

        return (
          <OptionCard
            key={mode.value}
            testID={`calorie-mode-${mode.value}`}
            label={explanation.title}
            description={explanation.body}
            selected={draft.calorieMode === mode.value}
            recommended={mode.value === DEFAULT_CALORIE_MODE}
            onPress={() => update({ calorieMode: mode.value })}
          />
        );
      })}

      <Text variant="caption" tone="textMuted">
        Quel que soit ton choix, l’application affiche toujours les deux vues : ton budget effectif
        et ce qu’il serait dans l’autre mode.
      </Text>
    </StepScreen>
  );
}
