import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StepScreen } from '@/components/onboarding/step-screen';
import { Chip, Text } from '@/components/ui';
import type {
  CardioActivityPractice,
  SportPractice,
  SportProfile,
  StrengthEnvironment,
} from '@/domain/profile/types';
import { trainingStepSchema } from '@/domain/profile/validation';
import { useOnboarding } from '@/hooks/use-onboarding';
import { nextStep, onboardingRoute, stepProgress } from '@/lib/onboarding-steps';

const PRACTICES: { value: SportPractice; label: string }[] = [
  { value: 'strength', label: 'Musculation' },
  { value: 'cardio', label: 'Cardio' },
];

const ENVIRONMENTS: { value: StrengthEnvironment; label: string }[] = [
  { value: 'gym', label: 'En salle' },
  { value: 'home', label: 'À la maison' },
];

const CARDIO_ACTIVITIES: { value: CardioActivityPractice; label: string }[] = [
  { value: 'walking', label: 'Marche' },
  { value: 'running', label: 'Course' },
  { value: 'cycling', label: 'Vélo' },
];

const DAYS = [0, 1, 2, 3, 4, 5, 6, 7];

const EMPTY_SPORT_PROFILE: SportProfile = {
  practices: [],
  strengthEnvironments: [],
  cardioActivities: [],
};

/**
 * Écran 7 — entraînement et sports pratiqués.
 *
 * Ces réponses ne changent pas les calculs de la Phase 1 : elles servent à
 * proposer, en Phase 8, des exercices réellement réalisables avec les moyens de
 * la personne. Rien n'est obligatoire.
 */
export default function TrainingScreen() {
  const router = useRouter();
  const { draft, update } = useOnboarding();

  const sportProfile = draft.sportProfile ?? EMPTY_SPORT_PROFILE;
  const trainingDaysPerWeek = draft.trainingDaysPerWeek;

  const validation = trainingStepSchema.safeParse({ trainingDaysPerWeek, sportProfile });

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  const updateSport = (patch: Partial<SportProfile>) =>
    update({ sportProfile: { ...sportProfile, ...patch } });

  return (
    <StepScreen
      testID="onboarding-training"
      title="Comment t’entraînes-tu ?"
      subtitle="Pour te proposer plus tard des séances réalisables avec ce que tu as sous la main."
      progress={stepProgress('training', draft.goalType)}
      primaryLabel="Continuer"
      primaryDisabled={!validation.success}
      onPrimary={() => {
        const next = nextStep('training', draft.goalType);
        if (next) {
          router.push(onboardingRoute(next));
        }
      }}
    >
      <View style={styles.group}>
        <Text variant="caption" tone="textMuted">
          Jours d’entraînement par semaine
        </Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {DAYS.map((day) => (
            <Chip
              role="radio"
              key={day}
              testID={`training-days-${day}`}
              label={String(day)}
              selected={trainingDaysPerWeek === day}
              onPress={() => update({ trainingDaysPerWeek: day })}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text variant="caption" tone="textMuted">
          Ce que tu pratiques
        </Text>
        <View style={styles.chips}>
          {PRACTICES.map((practice) => (
            <Chip
              key={practice.value}
              testID={`practice-${practice.value}`}
              label={practice.label}
              selected={sportProfile.practices.includes(practice.value)}
              onPress={() =>
                updateSport({ practices: toggle(sportProfile.practices, practice.value) })
              }
            />
          ))}
        </View>
      </View>

      {sportProfile.practices.includes('strength') ? (
        <View style={styles.group}>
          <Text variant="caption" tone="textMuted">
            Où fais-tu ta musculation ?
          </Text>
          <View style={styles.chips}>
            {ENVIRONMENTS.map((environment) => (
              <Chip
                key={environment.value}
                testID={`environment-${environment.value}`}
                label={environment.label}
                selected={sportProfile.strengthEnvironments.includes(environment.value)}
                onPress={() =>
                  updateSport({
                    strengthEnvironments: toggle(
                      sportProfile.strengthEnvironments,
                      environment.value,
                    ),
                  })
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {sportProfile.practices.includes('cardio') ? (
        <View style={styles.group}>
          <Text variant="caption" tone="textMuted">
            Quel type de cardio ?
          </Text>
          <View style={styles.chips}>
            {CARDIO_ACTIVITIES.map((activity) => (
              <Chip
                key={activity.value}
                testID={`cardio-${activity.value}`}
                label={activity.label}
                selected={sportProfile.cardioActivities.includes(activity.value)}
                onPress={() =>
                  updateSport({
                    cardioActivities: toggle(sportProfile.cardioActivities, activity.value),
                  })
                }
              />
            ))}
          </View>
        </View>
      ) : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
