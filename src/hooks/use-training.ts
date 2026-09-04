import { useCallback, useMemo } from 'react';

import { estimateCardioKcalFromEntry } from '@/domain/nutrition/calories-sport';
import { findMetEntry } from '@/domain/nutrition/mets-table';
import { EXERCISES_BY_ID } from '@/domain/training/content/exercises';
import { availableEquipment, recommendProgram } from '@/domain/training/programs';
import { nextProgressionTarget, type ProgressionTarget } from '@/domain/training/progression';
import type {
  CardioWorkout,
  Equipment,
  ExerciseSet,
  Program,
  ProgramExercise,
  StrengthExerciseLog,
  WorkoutLogEntry,
} from '@/domain/training/types';
import { useSessionStore } from '@/stores/session';

import { useStoredProfile } from './use-profile';
import { useRepositories } from './use-repositories';

/**
 * Séances de sport : programme recommandé, journalisation, progression.
 *
 * Entièrement local, donc disponible hors ligne comme le journal alimentaire.
 * Le hook orchestre — il lit le profil, appelle le domaine, écrit — mais ne
 * calcule ni dépense, ni charge cible, ni sélection de programme.
 */

/** Séances enregistrées pour une date. */
export function useWorkoutsForDate(date: string): WorkoutLogEntry[] {
  const repositories = useRepositories();
  const journalRevision = useSessionStore((state) => state.journalRevision);

  return useMemo(
    () => repositories.workout.getByDate(date),
    // Les séances partagent le jeton du journal : elles bougent avec le
    // contenu du jour et alimentent le même budget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repositories, date, journalRevision],
  );
}

export interface LogCardioInput {
  date: string;
  metEntryId: string;
  durationMin: number;
  distanceKm?: number;
}

/**
 * Enregistre une séance cardio.
 *
 * La dépense est estimée **une fois**, à l'enregistrement, et stockée telle
 * quelle — comme le snapshot nutritionnel d'une entrée de journal. Corriger son
 * poids plus tard ne réécrit pas les séances passées : ce qui a été estimé ce
 * jour-là reste ce qui a été estimé ce jour-là (PHASE_2 §2.4).
 */
export function useLogCardio(): (input: LogCardioInput) => WorkoutLogEntry {
  const repositories = useRepositories();
  const profile = useStoredProfile();
  const bump = useSessionStore((state) => state.bumpJournalRevision);

  return useCallback(
    ({ date, metEntryId, durationMin, distanceKm }: LogCardioInput) => {
      if (!profile) {
        throw new Error('Une séance ne peut être enregistrée sans profil.');
      }

      const entry = findMetEntry(metEntryId);

      if (!entry) {
        throw new Error(`Activité cardio inconnue : ${metEntryId}.`);
      }

      const payload: CardioWorkout = {
        type: 'cardio',
        activity: entry.activity,
        metEntryId,
        durationMin,
        ...(distanceKm === undefined ? {} : { distanceKm }),
      };

      const logged = repositories.workout.add({
        date,
        payload,
        estimatedKcalBurned: estimateCardioKcalFromEntry({
          metEntryId,
          weightKg: profile.currentWeightKg,
          durationMin,
        }),
      });

      bump();
      return logged;
    },
    [repositories, profile, bump],
  );
}

export interface LogStrengthInput {
  date: string;
  exercises: readonly { exerciseId: string; sets: readonly ExerciseSet[] }[];
  durationMin?: number;
}

/**
 * Enregistre une séance de musculation.
 *
 * **Aucune dépense n'est estimée**, délibérément : la musculation vise la
 * composition corporelle, pas la dépense, et une estimation METs y serait
 * trompeuse (DONNEES_SPORT §A.3). La séance est enregistrée et visible, elle
 * n'ouvre simplement aucun crédit calorique.
 *
 * Le nom de l'exercice est figé à l'enregistrement, comme le nom d'un aliment
 * dans le journal : l'historique reste lisible même si le noyau d'exercices
 * change à une mise à jour.
 */
export function useLogStrength(): (input: LogStrengthInput) => WorkoutLogEntry {
  const repositories = useRepositories();
  const bump = useSessionStore((state) => state.bumpJournalRevision);

  return useCallback(
    ({ date, exercises, durationMin }: LogStrengthInput) => {
      const logged: StrengthExerciseLog[] = exercises.map(({ exerciseId, sets }) => ({
        exerciseId,
        name: EXERCISES_BY_ID.get(exerciseId)?.name ?? exerciseId,
        sets: [...sets],
      }));

      const entry = repositories.workout.add({
        date,
        payload: {
          type: 'strength',
          exercises: logged,
          ...(durationMin === undefined ? {} : { durationMin }),
        },
      });

      bump();
      return entry;
    },
    [repositories, bump],
  );
}

/** Programme recommandé pour le profil, et matériel dont il dispose. */
export function useRecommendedProgram(): {
  program?: Program;
  equipment: Equipment[];
} {
  const profile = useStoredProfile();

  return useMemo(() => {
    if (!profile) {
      return { equipment: ['none'] as Equipment[] };
    }

    return {
      program: recommendProgram({ profile }),
      equipment: availableEquipment(profile),
    };
  }, [profile]);
}

/** Cible de la prochaine séance pour un exercice, d'après ce qui vient d'être réalisé. */
export function useProgressionTarget(): (input: {
  planned: ProgramExercise;
  performed: readonly ExerciseSet[];
  equipment: Equipment;
}) => ProgressionTarget {
  return useCallback((input) => nextProgressionTarget(input), []);
}
