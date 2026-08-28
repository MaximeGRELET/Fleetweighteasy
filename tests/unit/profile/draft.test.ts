import { InvalidInputError } from '@/domain/errors';
import {
  buildUserProfile,
  EMPTY_PROFILE_DRAFT,
  isDraftComplete,
  missingDraftFields,
  tryBuildUserProfile,
  type ProfileDraft,
} from '@/domain/profile/draft';

function completeDraft(overrides: Partial<ProfileDraft> = {}): ProfileDraft {
  return {
    goalType: 'weight_loss',
    sex: 'female',
    birthDate: '1992-06-10',
    heightCm: 168,
    currentWeightKg: 72.5,
    activityLevel: 'lightly_active',
    trainingDaysPerWeek: 3,
    dietType: 'omnivore',
    allergies: [],
    dislikes: [],
    calorieMode: 'fixed',
    ...overrides,
  };
}

describe('EMPTY_PROFILE_DRAFT', () => {
  it('part du mode calories recommandé', () => {
    expect(EMPTY_PROFILE_DRAFT.calorieMode).toBe('fixed');
  });

  it('n’est pas complet', () => {
    expect(isDraftComplete(EMPTY_PROFILE_DRAFT)).toBe(false);
  });
});

describe('missingDraftFields', () => {
  it('liste tout ce qui manque sur un brouillon vide', () => {
    expect(missingDraftFields(EMPTY_PROFILE_DRAFT)).toEqual([
      'goalType',
      'sex',
      'birthDate',
      'heightCm',
      'currentWeightKg',
      'activityLevel',
      'trainingDaysPerWeek',
      'dietType',
    ]);
  });

  it('ne renvoie rien sur un brouillon complet', () => {
    expect(missingDraftFields(completeDraft())).toEqual([]);
    expect(isDraftComplete(completeDraft())).toBe(true);
  });

  it('ne réclame ni le poids cible ni le rythme : ils sont facultatifs', () => {
    const missing = missingDraftFields(EMPTY_PROFILE_DRAFT);

    expect(missing).not.toContain('targetWeightKg');
    expect(missing).not.toContain('weeklyRateKg');
    expect(missing).not.toContain('sportProfile');
  });
});

describe('buildUserProfile', () => {
  it('assemble un profil marqué comme onboardé', () => {
    expect(buildUserProfile(completeDraft())).toEqual({
      sex: 'female',
      birthDate: '1992-06-10',
      heightCm: 168,
      currentWeightKg: 72.5,
      goalType: 'weight_loss',
      activityLevel: 'lightly_active',
      trainingDaysPerWeek: 3,
      dietType: 'omnivore',
      allergies: [],
      dislikes: [],
      calorieMode: 'fixed',
      onboardingCompleted: true,
    });
  });

  it('conserve le rythme visé en perte de poids', () => {
    expect(buildUserProfile(completeDraft({ weeklyRateKg: 0.5 })).weeklyRateKg).toBe(0.5);
  });

  it.each(['recomposition', 'maintenance'] as const)(
    'écarte le rythme visé pour l’objectif %s',
    (goalType) => {
      const profile = buildUserProfile(completeDraft({ goalType, weeklyRateKg: 0.5 }));

      expect('weeklyRateKg' in profile).toBe(false);
    },
  );

  it('conserve le poids cible et le profil sportif quand ils sont renseignés', () => {
    const sportProfile = {
      practices: ['cardio' as const],
      strengthEnvironments: [],
      cardioActivities: ['running' as const],
    };

    const profile = buildUserProfile(completeDraft({ targetWeightKg: 65, sportProfile }));

    expect(profile.targetWeightKg).toBe(65);
    expect(profile.sportProfile).toEqual(sportProfile);
  });

  it('omet les champs facultatifs absents plutôt que de les mettre à undefined', () => {
    const profile = buildUserProfile(completeDraft());

    expect('targetWeightKg' in profile).toBe(false);
    expect('sportProfile' in profile).toBe(false);
  });

  it('copie les listes : modifier le brouillon ensuite ne change pas le profil', () => {
    const draft = completeDraft({ allergies: ['gluten'] });
    const profile = buildUserProfile(draft);

    draft.allergies.push('lactose');

    expect(profile.allergies).toEqual(['gluten']);
  });

  it.each([
    'goalType',
    'sex',
    'birthDate',
    'heightCm',
    'currentWeightKg',
    'activityLevel',
    'trainingDaysPerWeek',
    'dietType',
  ] as const)('refuse un brouillon sans %s', (field) => {
    const draft = completeDraft();
    delete draft[field];

    expect(() => buildUserProfile(draft)).toThrow(InvalidInputError);
    expect(() => buildUserProfile(draft)).toThrow(new RegExp(field));
  });
});

describe('tryBuildUserProfile', () => {
  it('renvoie undefined tant que le brouillon est incomplet', () => {
    expect(tryBuildUserProfile(EMPTY_PROFILE_DRAFT)).toBeUndefined();
  });

  it('renvoie le profil dès qu’il est complet', () => {
    expect(tryBuildUserProfile(completeDraft())).toBeDefined();
  });
});
