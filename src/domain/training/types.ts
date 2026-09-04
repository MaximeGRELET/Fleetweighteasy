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

// --- Bibliothèque d'exercices (Phase 8) ------------------------------------

/**
 * Patterns moteurs couverts par le noyau.
 *
 * Un programme équilibré pioche dans chacun : c'est ce qui distingue un
 * programme d'une liste d'exercices (DONNEES_SPORT §B.2).
 */
export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'knee_dominant'
  | 'hip_dominant'
  | 'lunge'
  | 'core'
  | 'calves';

export type MuscleGroup =
  | 'chest'
  | 'shoulders'
  | 'triceps'
  | 'back'
  | 'biceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs';

/** `none` : sans matériel, à la maison. `gym` : salle équipée. */
export type Equipment = 'none' | 'gym';

export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
  id: string;
  /** Nom français, affiché tel quel. */
  name: string;
  pattern: MovementPattern;
  muscleGroups: readonly MuscleGroup[];
  equipment: Equipment;
  difficulty: TrainingLevel;
  /**
   * Consignes d'exécution et point de sécurité.
   *
   * **Vide en V1, délibérément.** Leur rédaction est un chantier de contenu
   * distinct (DONNEES_SPORT §C.2), au même titre que les briques de conseil :
   * ce sont des consignes de prévention des blessures, qui demandent une
   * relecture professionnelle. L'écran indique qu'elles sont à venir plutôt que
   * de laisser croire qu'un exercice n'en demande pas.
   */
  instructions: readonly string[];
  /** Démonstration vidéo. Prévue, non branchée (DONNEES_SPORT §C.3). */
  mediaUrl?: string;
}

// --- Programmes -------------------------------------------------------------

export type ProgramSplit = 'full_body' | 'upper_lower' | 'push_pull_legs';

export interface ProgramExercise {
  exerciseId: string;
  sets: number;
  /** Fourchette de répétitions visée, bornes comprises. */
  repRange: readonly [number, number];
  restSec: number;
}

export interface ProgramSession {
  /** Nom de séance, ex. « Full body A ». */
  name: string;
  exercises: readonly ProgramExercise[];
}

export interface Program {
  id: string;
  name: string;
  split: ProgramSplit;
  daysPerWeek: number;
  level: TrainingLevel;
  equipment: Equipment;
  sessions: readonly ProgramSession[];
}
