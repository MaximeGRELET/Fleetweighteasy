import {
  EXERCISES,
  EXERCISES_BY_ID,
  hasExecutionInstructions,
} from '@/domain/training/content/exercises';
import { PROGRAMS, PROGRAMS_BY_ID } from '@/domain/training/content/programs';
import type { MovementPattern } from '@/domain/training/types';

/**
 * Intégrité du noyau d'exercices et des programmes.
 *
 * Contenu transcrit à la main : ce sont ces tests, pas le typage, qui
 * empêchent un identifiant mal recopié ou un pattern oublié de passer.
 */
describe('noyau d’exercices', () => {
  it('compte les 31 mouvements du noyau', () => {
    expect(EXERCISES).toHaveLength(31);
    expect(EXERCISES_BY_ID.size).toBe(EXERCISES.length);
  });

  it('n’a aucun identifiant en double', () => {
    const ids = EXERCISES.map((exercise) => exercise.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  const ALL_PATTERNS: MovementPattern[] = [
    'horizontal_push',
    'vertical_push',
    'horizontal_pull',
    'vertical_pull',
    'knee_dominant',
    'hip_dominant',
    'lunge',
    'core',
    'calves',
  ];

  function patternsFor(equipment: 'none' | 'gym'): Set<MovementPattern> {
    return new Set(
      EXERCISES.filter((exercise) => exercise.equipment === equipment).map(
        (exercise) => exercise.pattern,
      ),
    );
  }

  it('couvre les neuf patterns moteurs, tous matériels confondus', () => {
    const covered = new Set(EXERCISES.map((exercise) => exercise.pattern));

    for (const pattern of ALL_PATTERNS) {
      expect(covered).toContain(pattern);
    }
  });

  it('couvre les neuf patterns en salle', () => {
    for (const pattern of ALL_PATTERNS) {
      expect(patternsFor('gym')).toContain(pattern);
    }
  });

  /**
   * **Trou connu du noyau maison : aucun tirage vertical.** La liste de
   * référence n'en propose pas — une traction demande une barre, que le
   * sans-matériel ne suppose pas. Le tirage horizontal (rowing sous table)
   * couvre partiellement le besoin, mais le pattern reste absent. Ce test fige
   * le constat pour qu'il soit visible plutôt qu'oublié ; il échouera le jour
   * où un exercice comblera le trou.
   */
  it('n’a pas de tirage vertical au poids du corps — trou connu du noyau maison', () => {
    const covered = patternsFor('none');

    expect(covered).not.toContain('vertical_pull');

    for (const pattern of ALL_PATTERNS.filter((p) => p !== 'vertical_pull')) {
      expect(covered).toContain(pattern);
    }
  });

  it('donne à chaque exercice un nom et au moins un groupe musculaire', () => {
    for (const exercise of EXERCISES) {
      expect(exercise.name.length).toBeGreaterThan(0);
      expect(exercise.muscleGroups.length).toBeGreaterThan(0);
    }
  });

  it('propose des mouvements à la maison et en salle', () => {
    expect(EXERCISES.filter((exercise) => exercise.equipment === 'none')).toHaveLength(14);
    expect(EXERCISES.filter((exercise) => exercise.equipment === 'gym')).toHaveLength(17);
  });

  /**
   * Les consignes d'exécution sont un chantier de contenu distinct
   * (DONNEES_SPORT §C.2) : ce sont des consignes de prévention des blessures,
   * qui demandent une relecture professionnelle. Ce test dit l'état actuel ; il
   * échouera le jour où le contenu arrivera, ce qui est le rappel voulu pour
   * retirer l'avertissement des écrans.
   */
  it('n’a pas encore de consignes d’exécution — chantier de contenu à venir', () => {
    for (const exercise of EXERCISES) {
      expect(hasExecutionInstructions(exercise)).toBe(false);
    }
  });
});

describe('programmes', () => {
  it('n’a aucun identifiant en double', () => {
    const ids = PROGRAMS.map((program) => program.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(PROGRAMS_BY_ID.size).toBe(PROGRAMS.length);
  });

  it('ne référence que des exercices du noyau', () => {
    for (const program of PROGRAMS) {
      for (const session of program.sessions) {
        for (const { exerciseId } of session.exercises) {
          expect(EXERCISES_BY_ID.has(exerciseId)).toBe(true);
        }
      }
    }
  });

  it('ne demande jamais un matériel que le programme ne suppose pas', () => {
    // Un programme maison qui glisserait un développé couché serait infaisable.
    // L'inverse est permis : un gainage se fait aussi bien en salle, et le
    // poids du corps ne demande rien à personne.
    for (const program of PROGRAMS.filter((p) => p.equipment === 'none')) {
      for (const session of program.sessions) {
        for (const { exerciseId } of session.exercises) {
          expect(EXERCISES_BY_ID.get(exerciseId)?.equipment).toBe('none');
        }
      }
    }
  });

  it('donne à chaque séance des séries, des fourchettes et du repos exploitables', () => {
    for (const program of PROGRAMS) {
      expect(program.sessions.length).toBeGreaterThan(0);

      for (const session of program.sessions) {
        expect(session.name.length).toBeGreaterThan(0);
        expect(session.exercises.length).toBeGreaterThan(0);

        for (const exercise of session.exercises) {
          const [minReps, maxReps] = exercise.repRange;

          expect(exercise.sets).toBeGreaterThan(0);
          expect(minReps).toBeGreaterThan(0);
          expect(maxReps).toBeGreaterThanOrEqual(minReps);
          expect(exercise.restSec).toBeGreaterThan(0);
        }
      }
    }
  });

  /**
   * La règle du document : « chaque séance couvre tous les patterns : une
   * poussée, un tirage, un dominante genou, un dominante hanche, un gainage »
   * (DONNEES_SPORT §B.5). Elle ne vaut que pour le full-body, un split
   * répartissant justement les patterns entre les séances.
   */
  it('fait couvrir tous les patterns par chaque séance full-body', () => {
    const fullBody = PROGRAMS.filter((program) => program.split === 'full_body');

    expect(fullBody.length).toBeGreaterThan(0);

    for (const program of fullBody) {
      for (const session of program.sessions) {
        const patterns = new Set(
          session.exercises.map(({ exerciseId }) => EXERCISES_BY_ID.get(exerciseId)?.pattern),
        );

        expect(patterns.has('core')).toBe(true);
        expect(patterns.has('hip_dominant')).toBe(true);
        // Poussée et tirage, horizontaux ou verticaux.
        expect(patterns.has('horizontal_push') || patterns.has('vertical_push')).toBe(true);
        expect(patterns.has('horizontal_pull') || patterns.has('vertical_pull')).toBe(true);
        // Dominante genou, fentes comprises.
        expect(patterns.has('knee_dominant') || patterns.has('lunge')).toBe(true);
      }
    }
  });

  it('couvre les trois découpages du socle', () => {
    const splits = new Set(PROGRAMS.map((program) => program.split));

    expect([...splits].sort()).toEqual(['full_body', 'push_pull_legs', 'upper_lower']);
  });

  it('décline le full-body et le haut/bas à la maison comme en salle', () => {
    for (const split of ['full_body', 'upper_lower'] as const) {
      const equipment = PROGRAMS.filter((program) => program.split === split).map(
        (program) => program.equipment,
      );

      expect(equipment.sort()).toEqual(['gym', 'none']);
    }
  });

  it('réserve le push/pull/legs à la salle', () => {
    // Le document le réserve à la salle : les mouvements d'isolation qu'il
    // suppose n'existent pas au poids du corps.
    for (const program of PROGRAMS.filter((p) => p.split === 'push_pull_legs')) {
      expect(program.equipment).toBe('gym');
    }
  });
});
