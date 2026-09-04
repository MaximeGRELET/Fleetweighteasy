import type { Exercise } from '../types';

/**
 * Noyau d'exercices V1 — 31 mouvements, maison et salle.
 *
 * Transcription de `files/DONNEES_SPORT.md` §B.4 : identifiants, patterns,
 * groupes musculaires et niveaux y sont déjà arrêtés.
 *
 * **`instructions` est vide partout, et c'est délibéré.** Leur rédaction est un
 * chantier de contenu distinct (§C.2), au même titre que les briques de
 * conseil : ce sont des consignes de prévention des blessures — dos neutre,
 * amplitude contrôlée, position des genoux — qui demandent une relecture par un
 * professionnel avant d'être montrées à quiconque soulève une barre. Les
 * inventer ici serait le contraire de prudent.
 *
 * L'écran affiche donc explicitement que les consignes sont à venir, plutôt que
 * de laisser croire qu'un exercice n'en demande pas.
 *
 * V1 = noyau, pas exhaustif : l'extension se fait en ajoutant des données
 * taggées, sans refonte (§B.1).
 */
export const EXERCISES: readonly Exercise[] = [
  // --- Maison, sans matériel -------------------------------------------------
  {
    id: 'pushup',
    name: 'Pompes',
    pattern: 'horizontal_push',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    equipment: 'none',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'incline_pushup',
    name: 'Pompes inclinées (sur support)',
    pattern: 'horizontal_push',
    muscleGroups: ['chest', 'triceps'],
    equipment: 'none',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'pike_pushup',
    name: 'Pompes piquées',
    pattern: 'vertical_push',
    muscleGroups: ['shoulders', 'triceps'],
    equipment: 'none',
    difficulty: 'intermediate',
    instructions: [],
  },
  {
    id: 'bodyweight_row',
    name: 'Rowing sous table / australien',
    pattern: 'horizontal_pull',
    muscleGroups: ['back', 'biceps'],
    equipment: 'none',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'superman',
    name: 'Superman (extension dorsale)',
    pattern: 'horizontal_pull',
    muscleGroups: ['back', 'glutes'],
    equipment: 'none',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'bodyweight_squat',
    name: 'Squat au poids du corps',
    pattern: 'knee_dominant',
    muscleGroups: ['quads', 'glutes'],
    equipment: 'none',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'split_squat',
    name: 'Fente bulgare (pied surélevé)',
    pattern: 'lunge',
    muscleGroups: ['quads', 'glutes'],
    equipment: 'none',
    difficulty: 'intermediate',
    instructions: [],
  },
  {
    id: 'walking_lunge',
    name: 'Fentes marchées',
    pattern: 'lunge',
    muscleGroups: ['quads', 'glutes'],
    equipment: 'none',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'glute_bridge',
    name: 'Pont fessier',
    pattern: 'hip_dominant',
    muscleGroups: ['glutes', 'hamstrings'],
    equipment: 'none',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'single_leg_rdl',
    name: 'Soulevé de terre unilatéral (sans charge)',
    pattern: 'hip_dominant',
    muscleGroups: ['hamstrings', 'glutes'],
    equipment: 'none',
    difficulty: 'intermediate',
    instructions: [],
  },
  {
    id: 'plank',
    name: 'Gainage planche',
    pattern: 'core',
    muscleGroups: ['abs'],
    equipment: 'none',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'side_plank',
    name: 'Gainage latéral',
    pattern: 'core',
    muscleGroups: ['abs'],
    equipment: 'none',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'dead_bug',
    name: 'Dead bug',
    pattern: 'core',
    muscleGroups: ['abs'],
    equipment: 'none',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'calf_raise_bw',
    name: 'Extensions mollets debout',
    pattern: 'calves',
    muscleGroups: ['calves'],
    equipment: 'none',
    difficulty: 'beginner',
    instructions: [],
  },

  // --- Salle -----------------------------------------------------------------
  {
    id: 'barbell_bench_press',
    name: 'Développé couché barre',
    pattern: 'horizontal_push',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    equipment: 'gym',
    difficulty: 'intermediate',
    instructions: [],
  },
  {
    id: 'dumbbell_bench_press',
    name: 'Développé couché haltères',
    pattern: 'horizontal_push',
    muscleGroups: ['chest', 'triceps'],
    equipment: 'gym',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'overhead_press',
    name: 'Développé militaire',
    pattern: 'vertical_push',
    muscleGroups: ['shoulders', 'triceps'],
    equipment: 'gym',
    difficulty: 'intermediate',
    instructions: [],
  },
  {
    id: 'dumbbell_shoulder_press',
    name: 'Développé épaules haltères',
    pattern: 'vertical_push',
    muscleGroups: ['shoulders', 'triceps'],
    equipment: 'gym',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'seated_row',
    name: 'Rowing assis à la poulie',
    pattern: 'horizontal_pull',
    muscleGroups: ['back', 'biceps'],
    equipment: 'gym',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'dumbbell_row',
    name: 'Rowing haltère',
    pattern: 'horizontal_pull',
    muscleGroups: ['back', 'biceps'],
    equipment: 'gym',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'lat_pulldown',
    name: 'Tirage vertical à la poulie',
    pattern: 'vertical_pull',
    muscleGroups: ['back', 'biceps'],
    equipment: 'gym',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'assisted_pullup',
    name: 'Traction assistée',
    pattern: 'vertical_pull',
    muscleGroups: ['back', 'biceps'],
    equipment: 'gym',
    difficulty: 'intermediate',
    instructions: [],
  },
  {
    id: 'barbell_squat',
    name: 'Squat barre',
    pattern: 'knee_dominant',
    muscleGroups: ['quads', 'glutes'],
    equipment: 'gym',
    difficulty: 'intermediate',
    instructions: [],
  },
  {
    id: 'leg_press',
    name: 'Presse à cuisses',
    pattern: 'knee_dominant',
    muscleGroups: ['quads', 'glutes'],
    equipment: 'gym',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'romanian_deadlift',
    name: 'Soulevé de terre roumain',
    pattern: 'hip_dominant',
    muscleGroups: ['hamstrings', 'glutes'],
    equipment: 'gym',
    difficulty: 'intermediate',
    instructions: [],
  },
  {
    id: 'leg_curl',
    name: 'Leg curl (ischios)',
    pattern: 'hip_dominant',
    muscleGroups: ['hamstrings'],
    equipment: 'gym',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'dumbbell_lunge',
    name: 'Fentes haltères',
    pattern: 'lunge',
    muscleGroups: ['quads', 'glutes'],
    equipment: 'gym',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'cable_crunch',
    name: 'Crunch à la poulie',
    pattern: 'core',
    muscleGroups: ['abs'],
    equipment: 'gym',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'machine_calf_raise',
    name: 'Extensions mollets machine',
    pattern: 'calves',
    muscleGroups: ['calves'],
    equipment: 'gym',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'bicep_curl',
    name: 'Curl biceps',
    pattern: 'horizontal_pull',
    muscleGroups: ['biceps'],
    equipment: 'gym',
    difficulty: 'beginner',
    instructions: [],
  },
  {
    id: 'triceps_pushdown',
    name: 'Extension triceps poulie',
    pattern: 'horizontal_push',
    muscleGroups: ['triceps'],
    equipment: 'gym',
    difficulty: 'beginner',
    instructions: [],
  },
];

export const EXERCISES_BY_ID: ReadonlyMap<string, Exercise> = new Map(
  EXERCISES.map((exercise) => [exercise.id, exercise]),
);

/**
 * Vrai tant que les consignes d'exécution n'ont pas été rédigées.
 *
 * Exposé pour que l'écran puisse le dire sans deviner, et pour qu'un test
 * signale le jour où le chantier de contenu sera terminé.
 */
export function hasExecutionInstructions(exercise: Exercise): boolean {
  return exercise.instructions.length > 0;
}
