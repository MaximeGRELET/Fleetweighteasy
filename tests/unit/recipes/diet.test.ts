import { InvalidInputError } from '@/domain/errors';
import { INGREDIENTS_BY_ID } from '@/domain/recipes/content/ingredients';
import { RECIPES } from '@/domain/recipes/content/recipes';
import {
  deriveAllergens,
  deriveDietTypes,
  EXCLUSIONS_BY_ORIGIN,
  resolveIngredients,
} from '@/domain/recipes/diet';
import { resolveRecipe } from '@/domain/recipes/nutrition';
import type { IngredientOrigin, IngredientRef, Recipe } from '@/domain/recipes/types';

function ref(id: string): IngredientRef {
  const found = INGREDIENTS_BY_ID.get(id);

  if (!found) {
    throw new Error(`Ingrédient de test introuvable : ${id}`);
  }

  return found;
}

function dietsOf(recipeId: string): readonly string[] {
  const recipe = RECIPES.find(({ id }) => id === recipeId);

  if (!recipe) {
    throw new Error(`Recette de test introuvable : ${recipeId}`);
  }

  return resolveRecipe(recipe).dietTypes;
}

describe('exclusions par origine', () => {
  const cases: [IngredientOrigin, string[]][] = [
    ['plant', []],
    ['honey', ['vegan']],
    ['dairy', ['vegan']],
    ['egg', ['vegan']],
    ['fish', ['vegan', 'vegetarian']],
    ['meat', ['vegan', 'vegetarian', 'pescatarian']],
  ];

  it.each(cases)('l’origine « %s » exclut %j', (origin, expected) => {
    expect(EXCLUSIONS_BY_ORIGIN[origin]).toEqual(expected);
  });

  it('n’exclut jamais le flexitarien ni l’omnivore', () => {
    // Le flexitarien réduit la viande sans la proscrire : rien ne le disqualifie.
    for (const exclusions of Object.values(EXCLUSIONS_BY_ORIGIN)) {
      expect(exclusions).not.toContain('flexitarian');
      expect(exclusions).not.toContain('omnivore');
    }
  });

  /**
   * La ligne oubliée par la table manuscrite du catalogue : le poulet et le
   * bœuf n'y excluaient que végétariens et végétaliens.
   */
  it('exclut le pescatarien de la viande, mais pas du poisson', () => {
    expect(EXCLUSIONS_BY_ORIGIN.meat).toContain('pescatarian');
    expect(EXCLUSIONS_BY_ORIGIN.fish).not.toContain('pescatarian');
  });
});

describe('deriveDietTypes', () => {
  it('ouvre tous les régimes à une recette entièrement végétale', () => {
    expect(deriveDietTypes([ref('lentils_raw'), ref('coconut_milk'), ref('onion')])).toEqual([
      'omnivore',
      'flexitarian',
      'pescatarian',
      'vegetarian',
      'vegan',
    ]);
  });

  it('retire le végétalien dès qu’un produit laitier apparaît', () => {
    expect(deriveDietTypes([ref('skyr')])).toEqual([
      'omnivore',
      'flexitarian',
      'pescatarian',
      'vegetarian',
    ]);
  });

  it('retire le végétarien pour le poisson, mais garde le pescatarien', () => {
    expect(deriveDietTypes([ref('salmon_raw')])).toEqual([
      'omnivore',
      'flexitarian',
      'pescatarian',
    ]);
  });

  it('ne laisse que flexitarien et omnivore pour la viande', () => {
    expect(deriveDietTypes([ref('chicken_breast_raw')])).toEqual(['omnivore', 'flexitarian']);
    expect(deriveDietTypes([ref('lean_beef_raw')])).toEqual(['omnivore', 'flexitarian']);
  });

  it('cumule les exclusions de plusieurs ingrédients', () => {
    // Poisson et laitage : le plus restrictif des deux l'emporte sur chaque régime.
    expect(deriveDietTypes([ref('canned_tuna'), ref('fromage_blanc_0')])).toEqual([
      'omnivore',
      'flexitarian',
      'pescatarian',
    ]);
  });

  it('exclut le végétalien du miel', () => {
    expect(deriveDietTypes([ref('honey')])).not.toContain('vegan');
    expect(deriveDietTypes([ref('honey')])).toContain('vegetarian');
  });

  it('ouvre tout à une liste vide', () => {
    expect(deriveDietTypes([])).toHaveLength(5);
  });
});

describe('deriveAllergens', () => {
  it('fait l’union des allergènes des ingrédients', () => {
    expect(deriveAllergens([ref('rolled_oats'), ref('soy_milk')])).toEqual(['gluten', 'soy']);
  });

  it('ne répète pas un allergène porté par deux ingrédients', () => {
    expect(deriveAllergens([ref('skyr'), ref('cheese_emmental')])).toEqual(['dairy']);
  });

  it('renvoie les allergènes dans un ordre stable', () => {
    // Deux recettes aux mêmes allergènes doivent les afficher pareil.
    expect(deriveAllergens([ref('granola'), ref('skyr')])).toEqual(
      deriveAllergens([ref('skyr'), ref('granola')]),
    );
  });

  it('ne signale rien pour des ingrédients sans allergène', () => {
    expect(deriveAllergens([ref('tomato'), ref('onion')])).toEqual([]);
  });

  it('repère le sésame du houmous', () => {
    // Allergène réglementé, absent des propositions d'onboarding avant la Phase 7.
    expect(deriveAllergens([ref('hummus')])).toEqual(['sesame']);
  });
});

describe('resolveIngredients', () => {
  it('associe chaque ingrédient à sa référence', () => {
    const recipe = RECIPES.find(({ id }) => id === 'apple_peanut_butter');
    const resolved = resolveIngredients(recipe as Recipe);

    expect(resolved.map(({ ref: found }) => found.id)).toEqual(['apple', 'peanut_butter']);
    expect(resolved[0].ingredient.quantityG).toBe(150);
  });

  it('refuse une recette dont un ingrédient est inconnu de la table', () => {
    // Même choix que pour les repas prédéfinis : refuser plutôt que d'afficher
    // une nutrition amputée et des allergènes incomplets.
    const broken: Recipe = {
      id: 'broken',
      name: 'Recette cassée',
      mealTypes: ['lunch'],
      tags: [],
      ingredients: [{ refId: 'ingredient_inexistant', quantityG: 100 }],
      steps: ['—'],
      prepTimeMin: 5,
      difficulty: 'easy',
      servings: 1,
    };

    expect(() => resolveIngredients(broken)).toThrow(InvalidInputError);
    expect(() => resolveIngredients(broken)).toThrow(/ingredient_inexistant/);
  });
});

describe('régimes dérivés du catalogue réel', () => {
  it('exclut le pescatarien des recettes de viande', () => {
    expect(dietsOf('chicken_quinoa_salad')).not.toContain('pescatarian');
    expect(dietsOf('chicken_basquaise')).not.toContain('pescatarian');
    expect(dietsOf('beef_greenbeans_potato')).not.toContain('pescatarian');
  });

  it('accepte le pescatarien sur les recettes de poisson', () => {
    expect(dietsOf('salmon_sweet_potato')).toContain('pescatarian');
    expect(dietsOf('cod_papillote')).toContain('pescatarian');
    expect(dietsOf('tuna_wrap')).toContain('pescatarian');
  });

  it('reconnaît les recettes entièrement végétales comme véganes', () => {
    expect(dietsOf('overnight_oats_vegan')).toContain('vegan');
    expect(dietsOf('chili_sin_carne')).toContain('vegan');
    expect(dietsOf('green_protein_smoothie')).toContain('vegan');
  });

  it('refuse le végétalien à une recette au lactosérum', () => {
    // Le document déclarait ce porridge « vegetarian » seulement ; la
    // dérivation retrouve la liste complète sans se tromper sur le végétalien.
    expect(dietsOf('porridge_banana')).not.toContain('vegan');
    expect(dietsOf('porridge_banana')).toContain('pescatarian');
  });
});
