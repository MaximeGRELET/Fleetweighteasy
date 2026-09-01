import {
  isOwnedElsewhere,
  matchesTags,
  profileTags,
  satisfiesCondition,
  TOPICS_OWNED_ELSEWHERE,
} from '@/domain/advice/rules';
import type { AdviceBlock, AdviceTag } from '@/domain/advice/types';
import type { UserProfile } from '@/domain/profile/types';

import { buildProfile } from '../profile-fixtures';

import { buildContext } from './advice-fixtures';

function buildBlock(overrides: Partial<AdviceBlock> = {}): AdviceBlock {
  return {
    id: 'hydration__default',
    topic: 'hydration',
    tags: [],
    priority: 20,
    title: 'Titre',
    body: 'Corps',
    ...overrides,
  };
}

describe('profileTags', () => {
  it('dérive objectif, régime et niveau d’activité', () => {
    const tags = profileTags(
      buildProfile({ goalType: 'weight_loss', dietType: 'vegan', activityLevel: 'sedentary' }),
      buildContext(),
    );

    expect(tags).toContain('goal:weight_loss');
    expect(tags).toContain('diet:vegan');
    expect(tags).toContain('activity:low');
  });

  it('regroupe les cinq niveaux d’activité en trois paliers', () => {
    const tagFor = (activityLevel: UserProfile['activityLevel']) =>
      profileTags(buildProfile({ activityLevel }), buildContext()).find((tag) =>
        tag.startsWith('activity:'),
      );

    expect(tagFor('sedentary')).toBe('activity:low');
    expect(tagFor('lightly_active')).toBe('activity:low');
    expect(tagFor('moderately_active')).toBe('activity:moderate');
    expect(tagFor('very_active')).toBe('activity:high');
    expect(tagFor('extremely_active')).toBe('activity:high');
  });

  it('prend l’ancienneté dans le contexte, pas dans le profil', () => {
    const profile = buildProfile();

    expect(profileTags(profile, buildContext({ isNewUser: true }))).toContain('user:new');
    expect(profileTags(profile, buildContext({ isNewUser: false }))).toContain('user:established');
  });

  it('marque `trains:none` en l’absence de profil sportif', () => {
    expect(profileTags(buildProfile({ sportProfile: undefined }), buildContext())).toContain(
      'trains:none',
    );
  });

  it('porte les deux disciplines quand elles sont pratiquées ensemble', () => {
    const tags = profileTags(
      buildProfile({
        sportProfile: {
          practices: ['strength', 'cardio'],
          strengthEnvironments: ['gym'],
          cardioActivities: ['running'],
        },
      }),
      buildContext(),
    );

    expect(tags).toContain('trains:strength');
    expect(tags).toContain('trains:cardio');
    expect(tags).not.toContain('trains:none');
  });

  it('n’attribue qu’une discipline quand une seule est pratiquée', () => {
    const tags = profileTags(
      buildProfile({
        sportProfile: {
          practices: ['cardio'],
          strengthEnvironments: [],
          cardioActivities: ['walking'],
        },
      }),
      buildContext(),
    );

    expect(tags).toContain('trains:cardio');
    expect(tags).not.toContain('trains:strength');
    expect(tags).not.toContain('trains:none');
  });

  it('traite une liste de pratiques vide comme une absence de sport', () => {
    const tags = profileTags(
      buildProfile({
        sportProfile: { practices: [], strengthEnvironments: [], cardioActivities: [] },
      }),
      buildContext(),
    );

    expect(tags).toContain('trains:none');
  });
});

describe('matchesTags', () => {
  const tags: AdviceTag[] = ['goal:weight_loss', 'diet:omnivore', 'trains:cardio'];

  it('accepte une brique sans tag : elle s’adresse à tout le monde', () => {
    expect(matchesTags(buildBlock({ tags: [] }), tags)).toBe(true);
  });

  it('exige que **tous** les tags correspondent, pas seulement un', () => {
    expect(matchesTags(buildBlock({ tags: ['goal:weight_loss', 'diet:omnivore'] }), tags)).toBe(
      true,
    );
    expect(matchesTags(buildBlock({ tags: ['goal:weight_loss', 'diet:vegan'] }), tags)).toBe(false);
  });

  it('rejette un tag absent du profil', () => {
    expect(matchesTags(buildBlock({ tags: ['trains:strength'] }), tags)).toBe(false);
  });
});

describe('satisfiesCondition', () => {
  it('accepte une brique sans condition', () => {
    expect(satisfiesCondition(buildBlock(), buildContext())).toBe(true);
  });

  it('accepte une brique dont la condition est remplie', () => {
    const block = buildBlock({ condition: { requires: { plateauDetected: true } } });

    expect(satisfiesCondition(block, buildContext({ plateauDetected: true }))).toBe(true);
  });

  it('rejette une brique dont la condition n’est pas remplie', () => {
    const block = buildBlock({ condition: { requires: { plateauDetected: true } } });

    expect(satisfiesCondition(block, buildContext({ plateauDetected: false }))).toBe(false);
  });

  it('sait exiger une valeur fausse, et pas seulement une valeur vraie', () => {
    // `hasWeighedThisWeek: false` est une condition à part entière : un simple
    // test de véracité ne saurait pas l'exprimer.
    const block = buildBlock({ condition: { requires: { hasWeighedThisWeek: false } } });

    expect(satisfiesCondition(block, buildContext({ hasWeighedThisWeek: false }))).toBe(true);
    expect(satisfiesCondition(block, buildContext({ hasWeighedThisWeek: true }))).toBe(false);
  });

  it('exige que toutes les clés de la condition soient satisfaites', () => {
    const block = buildBlock({
      condition: { requires: { plateauDetected: true, isNewUser: false } },
    });

    expect(
      satisfiesCondition(block, buildContext({ plateauDetected: true, isNewUser: false })),
    ).toBe(true);
    expect(
      satisfiesCondition(block, buildContext({ plateauDetected: true, isNewUser: true })),
    ).toBe(false);
  });

  it('accepte une condition vide', () => {
    expect(satisfiesCondition(buildBlock({ condition: {} }), buildContext())).toBe(true);
    expect(satisfiesCondition(buildBlock({ condition: { requires: {} } }), buildContext())).toBe(
      true,
    );
  });

  it('compare aussi les valeurs non booléennes', () => {
    const block = buildBlock({ condition: { requires: { weightTrend: 'up' } } });

    expect(satisfiesCondition(block, buildContext({ weightTrend: 'up' }))).toBe(true);
    expect(satisfiesCondition(block, buildContext({ weightTrend: 'down' }))).toBe(false);
  });
});

describe('topics possédés par un autre écran', () => {
  it('réserve le plateau à l’écran de suivi du poids', () => {
    expect(TOPICS_OWNED_ELSEWHERE).toEqual(['plateau']);
    expect(isOwnedElsewhere('plateau')).toBe(true);
  });

  it('laisse les autres topics au moteur', () => {
    expect(isOwnedElsewhere('hydration')).toBe(false);
    expect(isOwnedElsewhere('recovery_after_slip')).toBe(false);
  });
});
