import { InvalidInputError } from '@/domain/errors';
import {
  BODYWEIGHT_REP_INCREMENT,
  hasClearedRange,
  LOAD_INCREMENT_KG,
  nextProgressionTarget,
} from '@/domain/training/progression';
import type { ExerciseSet, ProgramExercise } from '@/domain/training/types';

/** Cible de séance : trois séries de 8 à 12. */
const PLANNED: ProgramExercise = {
  exerciseId: 'barbell_squat',
  sets: 3,
  repRange: [8, 12],
  restSec: 90,
};

function sets(reps: number[], weightKg?: number): ExerciseSet[] {
  return reps.map((count) => ({ reps: count, ...(weightKg === undefined ? {} : { weightKg }) }));
}

describe('hasClearedRange', () => {
  it('reconnaît une fourchette franchie sur toutes les séries', () => {
    expect(hasClearedRange(sets([12, 12, 12]), 3, 12)).toBe(true);
  });

  it('accepte un dépassement du haut de fourchette', () => {
    expect(hasClearedRange(sets([13, 12, 14]), 3, 12)).toBe(true);
  });

  /**
   * Douze répétitions à la première série puis huit aux suivantes ne veut pas
   * dire qu'il faut charger : la série de tête était trop facile, pas la séance.
   */
  it('refuse quand une seule série reste sous la fourchette', () => {
    expect(hasClearedRange(sets([12, 12, 8]), 3, 12)).toBe(false);
    expect(hasClearedRange(sets([12, 10, 12]), 3, 12)).toBe(false);
  });

  it('refuse quand des séries manquent', () => {
    // On ne progresse pas sur un volume qu'on n'a pas fait.
    expect(hasClearedRange(sets([12, 12]), 3, 12)).toBe(false);
    expect(hasClearedRange([], 3, 12)).toBe(false);
  });

  it('ignore les séries faites au-delà de ce qui était prévu', () => {
    expect(hasClearedRange(sets([12, 12, 12, 6]), 3, 12)).toBe(true);
  });
});

describe('nextProgressionTarget — salle', () => {
  it('augmente la charge quand la fourchette est franchie', () => {
    const target = nextProgressionTarget({
      planned: PLANNED,
      performed: sets([12, 12, 12], 60),
      equipment: 'gym',
    });

    expect(target.advice).toBe('increase_load');
    expect(target.weightKg).toBe(60 + LOAD_INCREMENT_KG);
    // La fourchette ne bouge pas : on redescend en bas de fourchette avec la
    // nouvelle charge.
    expect(target.repRange).toEqual([8, 12]);
    expect(target.sets).toBe(3);
  });

  it('conserve la charge quand la fourchette n’est pas franchie', () => {
    const target = nextProgressionTarget({
      planned: PLANNED,
      performed: sets([12, 10, 9], 60),
      equipment: 'gym',
    });

    expect(target.advice).toBe('hold');
    expect(target.weightKg).toBe(60);
    expect(target.repRange).toEqual([8, 12]);
  });

  it('retient la série la plus lourde, pas la dernière', () => {
    // Une série de finition allégée ne doit pas faire reculer la cible.
    const target = nextProgressionTarget({
      planned: PLANNED,
      performed: [
        { reps: 12, weightKg: 70 },
        { reps: 12, weightKg: 70 },
        { reps: 12, weightKg: 50 },
      ],
      equipment: 'gym',
    });

    expect(target.weightKg).toBe(70 + LOAD_INCREMENT_KG);
  });

  it('arrondit la charge au demi-kilo', () => {
    const target = nextProgressionTarget({
      planned: PLANNED,
      performed: sets([12, 12, 12], 42.3),
      equipment: 'gym',
    });

    expect(target.weightKg).toBe(45);
  });

  it('progresse en répétitions quand aucune charge n’a été relevée', () => {
    // Un mouvement de salle fait au poids du corps — traction assistée notée
    // sans charge : on ne peut pas proposer un poids qu'on ne connaît pas.
    const target = nextProgressionTarget({
      planned: PLANNED,
      performed: sets([12, 12, 12]),
      equipment: 'gym',
    });

    expect(target.advice).toBe('increase_reps');
    expect(target.weightKg).toBeUndefined();
  });
});

describe('nextProgressionTarget — poids du corps', () => {
  it('décale la fourchette vers le haut quand elle est franchie', () => {
    const target = nextProgressionTarget({
      planned: { ...PLANNED, exerciseId: 'pushup' },
      performed: sets([12, 12, 12]),
      equipment: 'none',
    });

    expect(target.advice).toBe('increase_reps');
    expect(target.repRange).toEqual([8 + BODYWEIGHT_REP_INCREMENT, 12 + BODYWEIGHT_REP_INCREMENT]);
    expect(target.weightKg).toBeUndefined();
  });

  it('conserve la fourchette quand elle n’est pas franchie', () => {
    const target = nextProgressionTarget({
      planned: { ...PLANNED, exerciseId: 'pushup' },
      performed: sets([10, 9, 8]),
      equipment: 'none',
    });

    expect(target.advice).toBe('hold');
    expect(target.repRange).toEqual([8, 12]);
  });

  it('n’invente pas de charge sur un mouvement lesté à la maison', () => {
    const target = nextProgressionTarget({
      planned: { ...PLANNED, exerciseId: 'pushup' },
      performed: sets([12, 12, 12], 10),
      equipment: 'none',
    });

    // Le sans-matériel progresse en répétitions, même si une charge a été notée.
    expect(target.advice).toBe('increase_reps');
    expect(target.weightKg).toBeUndefined();
  });
});

describe('nextProgressionTarget — robustesse', () => {
  it('est déterministe', () => {
    const input = {
      planned: PLANNED,
      performed: sets([12, 12, 12], 60),
      equipment: 'gym' as const,
    };

    expect(nextProgressionTarget(input)).toEqual(nextProgressionTarget(input));
  });

  it('refuse une fourchette de répétitions invalide', () => {
    expect(() =>
      nextProgressionTarget({
        planned: { ...PLANNED, repRange: [12, 8] },
        performed: sets([12, 12, 12], 60),
        equipment: 'gym',
      }),
    ).toThrow(InvalidInputError);

    expect(() =>
      nextProgressionTarget({
        planned: { ...PLANNED, repRange: [0, 12] },
        performed: sets([12, 12, 12], 60),
        equipment: 'gym',
      }),
    ).toThrow(InvalidInputError);

    expect(() =>
      nextProgressionTarget({
        planned: { ...PLANNED, repRange: [Number.NaN, 12] },
        performed: sets([12], 60),
        equipment: 'gym',
      }),
    ).toThrow(InvalidInputError);
  });

  it('tient sur une séance non réalisée', () => {
    const target = nextProgressionTarget({
      planned: PLANNED,
      performed: [],
      equipment: 'gym',
    });

    expect(target.advice).toBe('hold');
    expect(target.weightKg).toBeUndefined();
  });
});
