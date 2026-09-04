import { availableEquipment, eligiblePrograms, recommendProgram } from '@/domain/training/programs';
import type { SportProfile, UserProfile } from '@/domain/profile/types';
import type { Program } from '@/domain/training/types';

import { buildProfile } from '../profile-fixtures';

function sportProfile(overrides: Partial<SportProfile> = {}): SportProfile {
  return {
    practices: ['strength'],
    strengthEnvironments: ['gym'],
    cardioActivities: [],
    ...overrides,
  };
}

function profileWith(overrides: Partial<UserProfile> = {}): UserProfile {
  return buildProfile({ sportProfile: sportProfile(), trainingDaysPerWeek: 3, ...overrides });
}

describe('availableEquipment', () => {
  it('traduit les environnements du profil en matériel', () => {
    expect(availableEquipment(profileWith({ sportProfile: sportProfile() }))).toEqual(['gym']);
    expect(
      availableEquipment(
        profileWith({ sportProfile: sportProfile({ strengthEnvironments: ['home'] }) }),
      ),
    ).toEqual(['none']);
  });

  it('accepte les deux environnements à la fois', () => {
    expect(
      availableEquipment(
        profileWith({ sportProfile: sportProfile({ strengthEnvironments: ['gym', 'home'] }) }),
      ),
    ).toEqual(['gym', 'none']);
  });

  it('suppose le sans-matériel quand rien n’est déclaré', () => {
    // C'est le seul choix qui ne demande rien à personne.
    expect(availableEquipment(profileWith({ sportProfile: undefined }))).toEqual(['none']);
    expect(
      availableEquipment(profileWith({ sportProfile: sportProfile({ strengthEnvironments: [] }) })),
    ).toEqual(['none']);
  });
});

describe('eligiblePrograms', () => {
  it('ne propose jamais un programme de salle à qui s’entraîne chez lui', () => {
    // Proposer un développé couché à qui s'entraîne dans son salon n'est pas
    // un conseil, c'est un obstacle.
    const programs = eligiblePrograms({
      profile: profileWith({ sportProfile: sportProfile({ strengthEnvironments: ['home'] }) }),
    });

    expect(programs.length).toBeGreaterThan(0);

    for (const program of programs) {
      expect(program.equipment).toBe('none');
    }
  });

  it('ne propose pas un programme demandant plus de jours que disponibles', () => {
    const programs = eligiblePrograms({ profile: profileWith({ trainingDaysPerWeek: 3 }) });

    for (const program of programs) {
      expect(program.daysPerWeek).toBeLessThanOrEqual(3);
    }
  });

  it('ouvre les programmes plus longs quand les jours suivent', () => {
    const programs = eligiblePrograms({ profile: profileWith({ trainingDaysPerWeek: 6 }) });

    expect(programs.some((program) => program.split === 'push_pull_legs')).toBe(true);
  });

  it('mélange les deux matériels quand les deux sont déclarés', () => {
    const equipment = new Set(
      eligiblePrograms({
        profile: profileWith({
          trainingDaysPerWeek: 4,
          sportProfile: sportProfile({ strengthEnvironments: ['gym', 'home'] }),
        }),
      }).map((program) => program.equipment),
    );

    expect(equipment).toEqual(new Set(['gym', 'none']));
  });

  it('est déterministe', () => {
    const input = { profile: profileWith({ trainingDaysPerWeek: 4 }) };

    expect(eligiblePrograms(input).map((p) => p.id)).toEqual(
      eligiblePrograms(input).map((p) => p.id),
    );
  });

  /**
   * Deux programmes à égalité de jours et de niveau doivent s'ordonner par
   * identifiant : sans ce départage, l'ordre dépendrait de leur position dans
   * le catalogue, et en insérer un réordonnerait la liste de quelqu'un sans
   * raison visible.
   */
  it('départage deux programmes strictement à égalité par leur identifiant', () => {
    const base = {
      split: 'full_body' as const,
      daysPerWeek: 3,
      level: 'beginner' as const,
      equipment: 'gym' as const,
      sessions: [],
    };
    const alpha: Program = { ...base, id: 'aaa_programme', name: 'Alpha' };
    const omega: Program = { ...base, id: 'zzz_programme', name: 'Omega' };
    const profile = profileWith({ trainingDaysPerWeek: 3 });

    expect(eligiblePrograms({ profile, programs: [omega, alpha] }).map((p) => p.id)).toEqual([
      'aaa_programme',
      'zzz_programme',
    ]);
    expect(eligiblePrograms({ profile, programs: [alpha, omega] }).map((p) => p.id)).toEqual([
      'aaa_programme',
      'zzz_programme',
    ]);
  });

  /**
   * À jours égaux, c'est le niveau le plus accessible qui passe devant — et cela
   * prime sur l'ordre alphabétique. Un programme de débutant est sans danger
   * pour quelqu'un d'expérimenté ; l'inverse ne l'est pas.
   */
  it('fait passer le niveau le plus accessible devant, à jours égaux', () => {
    const base = {
      split: 'full_body' as const,
      daysPerWeek: 3,
      equipment: 'gym' as const,
      sessions: [],
    };
    // L'identifiant du programme avancé précède alphabétiquement celui du
    // débutant : seul le niveau peut expliquer l'ordre obtenu.
    const advanced: Program = {
      ...base,
      id: 'aaa_avance',
      name: 'Avancé',
      level: 'advanced',
    };
    const beginner: Program = {
      ...base,
      id: 'zzz_debutant',
      name: 'Débutant',
      level: 'beginner',
    };
    const profile = profileWith({ trainingDaysPerWeek: 3 });

    expect(eligiblePrograms({ profile, programs: [advanced, beginner] }).map((p) => p.id)).toEqual([
      'zzz_debutant',
      'aaa_avance',
    ]);
  });

  it('ne dépend pas de l’ordre du catalogue', () => {
    const profile = profileWith({ trainingDaysPerWeek: 4 });
    const forward = eligiblePrograms({ profile }).map((p) => p.id);
    const reversed = eligiblePrograms({
      profile,
      programs: [...eligiblePrograms({ profile })].reverse(),
    }).map((p) => p.id);

    expect(reversed).toEqual(forward);
  });
});

describe('recommendProgram', () => {
  it('recommande le full-body débutant à trois jours par semaine', () => {
    expect(recommendProgram({ profile: profileWith({ trainingDaysPerWeek: 3 }) })?.id).toBe(
      'full_body_beginner_gym',
    );
  });

  it('recommande la version maison à qui s’entraîne chez lui', () => {
    expect(
      recommendProgram({
        profile: profileWith({
          trainingDaysPerWeek: 3,
          sportProfile: sportProfile({ strengthEnvironments: ['home'] }),
        }),
      })?.id,
    ).toBe('full_body_beginner_home');
  });

  it('remplit les jours disponibles avant tout', () => {
    // Quatre jours disponibles : le haut/bas colle mieux qu'un full-body à trois.
    expect(recommendProgram({ profile: profileWith({ trainingDaysPerWeek: 4 }) })?.split).toBe(
      'upper_lower',
    );
  });

  /**
   * Aucun niveau n'est déclaré à l'onboarding. Le nombre de jours disponibles
   * dit la disponibilité, pas l'expérience : on ne prescrit donc jamais un
   * programme avancé, même quand les jours le permettraient.
   */
  it('ne recommande jamais un programme avancé, faute de niveau déclaré', () => {
    const recommended = recommendProgram({ profile: profileWith({ trainingDaysPerWeek: 6 }) });

    expect(recommended?.level).not.toBe('advanced');
  });

  it('laisse malgré tout le programme avancé consultable', () => {
    // Plafonner la recommandation n'est pas masquer : quelqu'un d'expérimenté
    // doit pouvoir choisir lui-même.
    const programs = eligiblePrograms({ profile: profileWith({ trainingDaysPerWeek: 6 }) });

    expect(programs.some((program) => program.level === 'advanced')).toBe(true);
  });

  it('ne recommande rien à qui déclare ne pas s’entraîner', () => {
    // Lui imposer un programme reviendrait à ignorer ce qu'il a répondu.
    const programs = eligiblePrograms({ profile: profileWith({ trainingDaysPerWeek: 0 }) });

    expect(programs.every((program) => program.daysPerWeek <= 1)).toBe(true);
  });

  it('ne renvoie rien quand aucun programme ne convient', () => {
    expect(recommendProgram({ profile: profileWith(), programs: [] })).toBeUndefined();
  });
});
