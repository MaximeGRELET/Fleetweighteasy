import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Callout, Text, TextField } from '@/components/ui';
import { EXERCISES_BY_ID } from '@/domain/training/content/exercises';
import { nextProgressionTarget } from '@/domain/training/progression';
import type { ExerciseSet, ProgramExercise } from '@/domain/training/types';
import { useTheme } from '@/hooks/use-theme';
import { useLogStrength, useRecommendedProgram } from '@/hooks/use-training';
import { SPORT_DISCLAIMER } from '@/lib/legal';
import { PROGRESSION_ADVICE } from '@/lib/messages/training';
import { useSessionStore } from '@/stores/session';

/**
 * Séance de musculation : exécution guidée et journalisation.
 *
 * Aucune dépense calorique n'est affichée, délibérément : la musculation vise
 * la composition corporelle, pas la dépense, et une estimation y serait
 * trompeuse (DONNEES_SPORT §A.3). La séance est enregistrée et visible, elle
 * n'ouvre simplement aucun crédit alimentaire.
 */
export default function StrengthScreen() {
  const theme = useTheme();
  const router = useRouter();
  const selectedDate = useSessionStore((state) => state.selectedDate);

  const { program, equipment } = useRecommendedProgram();
  const logStrength = useLogStrength();

  const session = program?.sessions[0];
  const [reps, setReps] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  if (!program || !session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.content}>
            <Text variant="body" tone="textMuted" testID="strength-no-program">
              Aucun programme ne correspond à ce que tu as indiqué dans ton profil.
            </Text>
            <Button label="Revenir" variant="secondary" onPress={() => router.back()} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  /** Séries réalisées pour un exercice, telles que saisies. */
  function performedSets(planned: ProgramExercise): ExerciseSet[] {
    const repsValue = Number(reps[planned.exerciseId] ?? '');
    const weightValue = Number(weights[planned.exerciseId] ?? '');

    if (!Number.isFinite(repsValue) || repsValue <= 0) {
      return [];
    }

    return Array.from({ length: planned.sets }, () => ({
      reps: repsValue,
      ...(Number.isFinite(weightValue) && weightValue > 0 ? { weightKg: weightValue } : {}),
    }));
  }

  function save() {
    if (!session) {
      return;
    }

    const exercises = session.exercises
      .map((planned) => ({ exerciseId: planned.exerciseId, sets: performedSets(planned) }))
      .filter(({ sets }) => sets.length > 0);

    if (exercises.length === 0) {
      return;
    }

    logStrength({ date: selectedDate, exercises });
    setSaved(true);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={[styles.content, { maxWidth: theme.maxContentWidth }]}>
          <View style={styles.heading}>
            <Text variant="caption" tone="textMuted">
              {program.name}
            </Text>
            <Text variant="title">{session.name}</Text>
          </View>

          {/* Les consignes d'exécution ne sont pas encore rédigées : le dire
              vaut mieux que de laisser croire qu'un mouvement n'en demande pas. */}
          <Callout
            tone="caution"
            title="Consignes d’exécution à venir"
            body={`Les repères de forme et de sécurité pour chaque mouvement seront ajoutés prochainement. ${SPORT_DISCLAIMER}`}
            testID="strength-instructions-pending"
          />

          {session.exercises.map((planned) => {
            const exercise = EXERCISES_BY_ID.get(planned.exerciseId);
            const performed = performedSets(planned);
            const target =
              performed.length > 0
                ? nextProgressionTarget({
                    planned,
                    performed,
                    equipment: exercise?.equipment ?? equipment[0],
                  })
                : undefined;

            return (
              <View key={planned.exerciseId} style={styles.exercise}>
                <Text variant="subheading">{exercise?.name ?? planned.exerciseId}</Text>
                <Text variant="caption" tone="textMuted">
                  {planned.sets} séries × {planned.repRange[0]}–{planned.repRange[1]} répétitions ·{' '}
                  {planned.restSec} s de repos
                </Text>

                <View style={styles.inputs}>
                  <View style={styles.input}>
                    <TextField
                      label="Répétitions"
                      value={reps[planned.exerciseId] ?? ''}
                      onChangeText={(value) =>
                        setReps((current) => ({ ...current, [planned.exerciseId]: value }))
                      }
                      keyboardType="number-pad"
                      testID={`strength-reps-${planned.exerciseId}`}
                    />
                  </View>
                  <View style={styles.input}>
                    <TextField
                      label="Charge"
                      value={weights[planned.exerciseId] ?? ''}
                      onChangeText={(value) =>
                        setWeights((current) => ({ ...current, [planned.exerciseId]: value }))
                      }
                      suffix="kg"
                      keyboardType="decimal-pad"
                      testID={`strength-weight-${planned.exerciseId}`}
                    />
                  </View>
                </View>

                {target ? (
                  <Text
                    variant="caption"
                    tone="textMuted"
                    testID={`strength-progression-${planned.exerciseId}`}
                  >
                    {PROGRESSION_ADVICE[target.advice]}
                    {target.weightKg === undefined ? '' : ` Cible : ${target.weightKg} kg.`}
                  </Text>
                ) : null}
              </View>
            );
          })}

          <Button label="Enregistrer la séance" onPress={save} testID="strength-save" />

          {saved ? (
            <Text variant="caption" tone="primary" testID="strength-saved">
              Séance enregistrée.
            </Text>
          ) : null}

          <Button
            label="Revenir"
            variant="secondary"
            onPress={() => router.back()}
            testID="strength-back"
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%' },
  content: { padding: 24, gap: 12, alignSelf: 'center', width: '100%' },
  heading: { gap: 4 },
  exercise: { gap: 6 },
  inputs: { flexDirection: 'row', gap: 12 },
  input: { flex: 1 },
});
