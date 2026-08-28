import type { CardioActivity } from '@/domain/nutrition/mets-table';

/**
 * Modèle des séances.
 *
 * Cardio et musculation ne se modélisent pas pareil (PLAN_IMPLEMENTATION §4.4) :
 * une union discriminée sur `type` plutôt qu'un objet aux champs creux.
 */

export interface CardioWorkout {
  type: 'cardio';
  activity: CardioActivity;
  /** Identifiant d'entrée de la table METs, pour retracer l'estimation. */
  metEntryId: string;
  durationMin: number;
  distanceKm?: number;
}

/** Une série réalisée. `weightKg` absent pour le poids du corps. */
export interface ExerciseSet {
  reps: number;
  weightKg?: number;
}

export interface StrengthExerciseLog {
  exerciseId: string;
  name: string;
  sets: ExerciseSet[];
}

export interface StrengthWorkout {
  type: 'strength';
  exercises: StrengthExerciseLog[];
  durationMin?: number;
}

export type WorkoutPayload = CardioWorkout | StrengthWorkout;

export interface WorkoutLogEntry {
  id: string;
  /** Date civile `YYYY-MM-DD`. */
  date: string;
  payload: WorkoutPayload;
  /**
   * Dépense estimée. Indicative et souvent surestimée : c'est la raison même du
   * mode calories `fixed` par défaut. Absente pour la musculation en V1, qui
   * vise la composition corporelle et non la dépense.
   */
  estimatedKcalBurned?: number;
}

export type NewWorkoutLogEntry = Omit<WorkoutLogEntry, 'id'>;
