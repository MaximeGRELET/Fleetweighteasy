import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Callout, Text } from '@/components/ui';
import { findMetEntry } from '@/domain/nutrition/mets-table';
import type { WorkoutLogEntry } from '@/domain/training/types';
import { useDailyBudget } from '@/hooks/use-daily-budget';
import { useTheme } from '@/hooks/use-theme';
import { useRecommendedProgram, useWorkoutsForDate } from '@/hooks/use-training';
import { formatKcal } from '@/lib/format';
import { SPORT_DISCLAIMER } from '@/lib/legal';
import { useSessionStore } from '@/stores/session';

/**
 * Accueil du sport : séances du jour, programme recommandé, accès aux saisies.
 *
 * Le bilan calorique reste piloté par le `calorieMode` du profil, appliqué par
 * `buildDailyBudget` — cet écran l'affiche, il ne le recalcule pas. C'est ce qui
 * garantit qu'une séance ne peut pas ouvrir un crédit que le tableau du jour
 * ignorerait, ni l'inverse.
 */
export default function TrainingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const selectedDate = useSessionStore((state) => state.selectedDate);

  const workouts = useWorkoutsForDate(selectedDate);
  const budget = useDailyBudget(selectedDate);
  const { program, equipment } = useRecommendedProgram();

  const cardioKcal = workouts.reduce((total, entry) => total + (entry.estimatedKcalBurned ?? 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={[styles.content, { maxWidth: theme.maxContentWidth }]}>
          <View style={styles.heading}>
            <Text variant="caption" tone="textMuted">
              Sport
            </Text>
            <Text variant="title">Tes séances</Text>
          </View>

          {cardioKcal > 0 ? (
            <Text variant="body" tone="textMuted" testID="training-estimate">
              {formatKcal(cardioKcal)} estimées aujourd’hui.{' '}
              {budget?.active.mode === 'credited'
                ? 'Elles sont ajoutées à ton budget du jour.'
                : 'Elles ne sont pas ajoutées à ton budget : ton niveau d’activité les prend déjà en compte.'}
            </Text>
          ) : null}

          <Button
            label="Enregistrer une séance cardio"
            onPress={() => router.push('/training/cardio')}
            testID="training-log-cardio"
          />

          <Text variant="subheading" style={styles.section}>
            Ton programme
          </Text>

          {program ? (
            <>
              <Text variant="body" testID="training-program">
                {program.name} — {program.daysPerWeek} séances par semaine
              </Text>
              <Button
                label="Voir la séance"
                variant="secondary"
                onPress={() => router.push('/training/strength')}
                testID="training-open-strength"
              />
            </>
          ) : (
            <Text variant="body" tone="textMuted" testID="training-no-program">
              Aucun programme ne correspond à ce que tu as indiqué. Renseigne tes jours
              d’entraînement et ton matériel dans ton profil pour en recevoir un.
            </Text>
          )}

          <Text variant="caption" tone="textMuted">
            {equipment.includes('gym')
              ? 'Programmes de salle, d’après ton profil.'
              : 'Programmes sans matériel, d’après ton profil.'}
          </Text>

          <Text variant="subheading" style={styles.section}>
            Aujourd’hui
          </Text>

          {workouts.length > 0 ? (
            workouts.map((workout) => (
              <WorkoutRow key={workout.id} workout={workout} testID={`workout-${workout.id}`} />
            ))
          ) : (
            <Text variant="body" tone="textMuted" testID="training-empty">
              Aucune séance enregistrée aujourd’hui.
            </Text>
          )}

          <Callout
            tone="caution"
            title="Avant de commencer"
            body={SPORT_DISCLAIMER}
            testID="training-disclaimer"
          />

          <Button
            label="Revenir au journal"
            variant="secondary"
            onPress={() => router.back()}
            testID="training-back"
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Une séance enregistrée, cardio ou musculation. */
function WorkoutRow({ workout, testID }: { workout: WorkoutLogEntry; testID: string }) {
  if (workout.payload.type === 'cardio') {
    const entry = findMetEntry(workout.payload.metEntryId);

    return (
      <Text variant="body" testID={testID}>
        {entry?.label ?? workout.payload.activity} — {workout.payload.durationMin} min ·{' '}
        {formatKcal(workout.estimatedKcalBurned ?? 0)} estimées
      </Text>
    );
  }

  const totalSets = workout.payload.exercises.reduce(
    (total, exercise) => total + exercise.sets.length,
    0,
  );

  return (
    <Text variant="body" testID={testID}>
      Musculation — {workout.payload.exercises.length} exercices, {totalSets} séries
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%' },
  content: { padding: 24, gap: 10, alignSelf: 'center', width: '100%' },
  heading: { gap: 4 },
  section: { marginTop: 12 },
});
