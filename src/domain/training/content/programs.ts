import type { Program } from '../types';

/**
 * Programmes du socle V1.
 *
 * Le document de référence fixe la **règle**, pas la liste : « chaque séance
 * couvre tous les patterns : une poussée, un tirage, un dominante genou, un
 * dominante hanche, un gainage » (DONNEES_SPORT §B.5). Les séances ci-dessous
 * appliquent cette règle au noyau d'exercices ; un test la revérifie sur chaque
 * séance full-body, pour qu'une modification du contenu ne puisse pas la
 * rompre en silence.
 *
 * Volumes retenus, faute d'être spécifiés : trois séries, fourchette 8–12
 * répétitions et 90 secondes de repos sur les mouvements polyarticulaires — les
 * repères usuels d'un travail en hypertrophie pour débutants et intermédiaires.
 * Le gainage se compte en secondes plutôt qu'en répétitions ; il est exprimé en
 * répétitions par cohérence de structure, et l'écran l'affiche comme une durée.
 */

const HYPERTROPHY_REPS = [8, 12] as const;
const CORE_REPS = [8, 15] as const;
const COMPOUND_REST_SEC = 90;
const ISOLATION_REST_SEC = 60;

export const PROGRAMS: readonly Program[] = [
  // --- Full body débutant, maison ------------------------------------------
  {
    id: 'full_body_beginner_home',
    name: 'Full body débutant — maison',
    split: 'full_body',
    daysPerWeek: 3,
    level: 'beginner',
    equipment: 'none',
    sessions: [
      {
        name: 'Full body A',
        exercises: [
          { exerciseId: 'pushup', sets: 3, repRange: HYPERTROPHY_REPS, restSec: COMPOUND_REST_SEC },
          {
            exerciseId: 'bodyweight_row',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'bodyweight_squat',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'glute_bridge',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: ISOLATION_REST_SEC,
          },
          { exerciseId: 'plank', sets: 3, repRange: CORE_REPS, restSec: ISOLATION_REST_SEC },
        ],
      },
      {
        name: 'Full body B',
        exercises: [
          {
            exerciseId: 'incline_pushup',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'superman',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: ISOLATION_REST_SEC,
          },
          {
            exerciseId: 'walking_lunge',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'single_leg_rdl',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          { exerciseId: 'dead_bug', sets: 3, repRange: CORE_REPS, restSec: ISOLATION_REST_SEC },
        ],
      },
    ],
  },

  // --- Full body débutant, salle --------------------------------------------
  {
    id: 'full_body_beginner_gym',
    name: 'Full body débutant — salle',
    split: 'full_body',
    daysPerWeek: 3,
    level: 'beginner',
    equipment: 'gym',
    sessions: [
      {
        name: 'Full body A',
        exercises: [
          {
            exerciseId: 'dumbbell_bench_press',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'seated_row',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'leg_press',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'leg_curl',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: ISOLATION_REST_SEC,
          },
          { exerciseId: 'cable_crunch', sets: 3, repRange: CORE_REPS, restSec: ISOLATION_REST_SEC },
        ],
      },
      {
        name: 'Full body B',
        exercises: [
          {
            exerciseId: 'dumbbell_shoulder_press',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'lat_pulldown',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'dumbbell_lunge',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'romanian_deadlift',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          { exerciseId: 'plank', sets: 3, repRange: CORE_REPS, restSec: ISOLATION_REST_SEC },
        ],
      },
    ],
  },

  // --- Upper / Lower intermédiaire, maison ----------------------------------
  {
    id: 'upper_lower_intermediate_home',
    name: 'Haut / bas intermédiaire — maison',
    split: 'upper_lower',
    daysPerWeek: 4,
    level: 'intermediate',
    equipment: 'none',
    sessions: [
      {
        name: 'Haut du corps',
        exercises: [
          { exerciseId: 'pushup', sets: 4, repRange: HYPERTROPHY_REPS, restSec: COMPOUND_REST_SEC },
          {
            exerciseId: 'pike_pushup',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'bodyweight_row',
            sets: 4,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'superman',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: ISOLATION_REST_SEC,
          },
          { exerciseId: 'side_plank', sets: 3, repRange: CORE_REPS, restSec: ISOLATION_REST_SEC },
        ],
      },
      {
        name: 'Bas du corps',
        exercises: [
          {
            exerciseId: 'split_squat',
            sets: 4,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'bodyweight_squat',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'single_leg_rdl',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'glute_bridge',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: ISOLATION_REST_SEC,
          },
          {
            exerciseId: 'calf_raise_bw',
            sets: 3,
            repRange: CORE_REPS,
            restSec: ISOLATION_REST_SEC,
          },
        ],
      },
    ],
  },

  // --- Upper / Lower intermédiaire, salle -----------------------------------
  {
    id: 'upper_lower_intermediate_gym',
    name: 'Haut / bas intermédiaire — salle',
    split: 'upper_lower',
    daysPerWeek: 4,
    level: 'intermediate',
    equipment: 'gym',
    sessions: [
      {
        name: 'Haut du corps',
        exercises: [
          {
            exerciseId: 'barbell_bench_press',
            sets: 4,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'overhead_press',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'lat_pulldown',
            sets: 4,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'dumbbell_row',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'bicep_curl',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: ISOLATION_REST_SEC,
          },
        ],
      },
      {
        name: 'Bas du corps',
        exercises: [
          {
            exerciseId: 'barbell_squat',
            sets: 4,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'romanian_deadlift',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'leg_press',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'leg_curl',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: ISOLATION_REST_SEC,
          },
          {
            exerciseId: 'machine_calf_raise',
            sets: 3,
            repRange: CORE_REPS,
            restSec: ISOLATION_REST_SEC,
          },
        ],
      },
    ],
  },

  // --- Push / Pull / Legs, salle --------------------------------------------
  // Le document le réserve à la salle (« salle surtout ») : les mouvements
  // d'isolation qu'il suppose n'existent pas au poids du corps.
  {
    id: 'push_pull_legs_advanced_gym',
    name: 'Push / Pull / Legs — salle',
    split: 'push_pull_legs',
    daysPerWeek: 6,
    level: 'advanced',
    equipment: 'gym',
    sessions: [
      {
        name: 'Push',
        exercises: [
          {
            exerciseId: 'barbell_bench_press',
            sets: 4,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'overhead_press',
            sets: 4,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'dumbbell_bench_press',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'triceps_pushdown',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: ISOLATION_REST_SEC,
          },
        ],
      },
      {
        name: 'Pull',
        exercises: [
          {
            exerciseId: 'assisted_pullup',
            sets: 4,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'seated_row',
            sets: 4,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'dumbbell_row',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'bicep_curl',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: ISOLATION_REST_SEC,
          },
        ],
      },
      {
        name: 'Legs',
        exercises: [
          {
            exerciseId: 'barbell_squat',
            sets: 4,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'romanian_deadlift',
            sets: 4,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'dumbbell_lunge',
            sets: 3,
            repRange: HYPERTROPHY_REPS,
            restSec: COMPOUND_REST_SEC,
          },
          {
            exerciseId: 'machine_calf_raise',
            sets: 3,
            repRange: CORE_REPS,
            restSec: ISOLATION_REST_SEC,
          },
        ],
      },
    ],
  },
];

export const PROGRAMS_BY_ID: ReadonlyMap<string, Program> = new Map(
  PROGRAMS.map((program) => [program.id, program]),
);
