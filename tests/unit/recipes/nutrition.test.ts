import { InvalidInputError } from '@/domain/errors';
import { RECIPES } from '@/domain/recipes/content/recipes';
import {
  portionWeightG,
  recipeTotals,
  recipeWeightG,
  resolveRecipe,
  snapshotForRecipe,
} from '@/domain/recipes/nutrition';
import type { Recipe } from '@/domain/recipes/types';

function recipe(id: string): Recipe {
  const found = RECIPES.find((candidate) => candidate.id === id);

  if (!found) {
    throw new Error(`Recette de test introuvable : ${id}`);
  }

  return found;
}

/** Recette artificielle aux chiffres ronds, pour vérifier l'arithmétique. */
const SIMPLE: Recipe = {
  id: 'test_simple',
  name: 'Recette de contrôle',
  mealTypes: ['lunch'],
  tags: [],
  // 200 g d'huile d'olive : 884 kcal et 100 g de lipides pour 100 g.
  ingredients: [{ refId: 'olive_oil', quantityG: 200 }],
  steps: ['—'],
  prepTimeMin: 5,
  difficulty: 'easy',
  servings: 2,
};

describe('recipeTotals', () => {
  it('applique les valeurs de la table au prorata des quantités', () => {
    expect(recipeTotals(SIMPLE)).toEqual({
      kcal: 1768,
      proteinG: 0,
      carbsG: 0,
      fatG: 200,
    });
  });

  it('somme tous les ingrédients', () => {
    // Pomme 150 g (52 kcal/100) + beurre de cacahuète 20 g (588 kcal/100).
    expect(recipeTotals(recipe('apple_peanut_butter')).kcal).toBe(Math.round(78 + 117.6));
  });

  it('porte sur la recette entière, portions non comprises', () => {
    // Deux portions : les totaux restent ceux du plat complet.
    const totals = recipeTotals(recipe('chicken_quinoa_salad'));
    const perServing = resolveRecipe(recipe('chicken_quinoa_salad')).nutritionPerServing;

    expect(totals.kcal).toBeGreaterThan(perServing.kcal * 1.9);
  });
});

describe('resolveRecipe', () => {
  it('divise les totaux par le nombre de portions', () => {
    const resolved = resolveRecipe(SIMPLE);

    expect(resolved.nutritionPerServing).toEqual({
      kcal: 884,
      proteinG: 0,
      carbsG: 0,
      fatG: 100,
    });
  });

  it('calcule le poids d’une portion', () => {
    expect(resolveRecipe(SIMPLE).servingWeightG).toBe(100);
    expect(recipeWeightG(SIMPLE)).toBe(200);
  });

  it('conserve les champs de la recette', () => {
    const resolved = resolveRecipe(recipe('red_lentil_dahl'));

    expect(resolved.id).toBe('red_lentil_dahl');
    expect(resolved.servings).toBe(3);
    expect(resolved.steps).toHaveLength(3);
  });

  it('joint allergènes et régimes dérivés', () => {
    const resolved = resolveRecipe(recipe('greek_yogurt_granola'));

    expect(resolved.allergens).toEqual(['gluten', 'dairy', 'nuts']);
    expect(resolved.dietTypes).not.toContain('vegan');
  });

  it('refuse une recette sans ingrédient', () => {
    expect(() => resolveRecipe({ ...SIMPLE, ingredients: [] })).toThrow(InvalidInputError);
  });

  it('refuse un nombre de portions absurde', () => {
    expect(() => resolveRecipe({ ...SIMPLE, servings: 0 })).toThrow(InvalidInputError);
    expect(() => resolveRecipe({ ...SIMPLE, servings: -1 })).toThrow(InvalidInputError);
    expect(() => resolveRecipe({ ...SIMPLE, servings: Number.NaN })).toThrow(InvalidInputError);
  });
});

describe('snapshotForRecipe', () => {
  it('fige les valeurs d’une portion', () => {
    expect(snapshotForRecipe(SIMPLE)).toEqual({
      name: 'Recette de contrôle',
      kcal: 884,
      proteinG: 0,
      carbsG: 0,
      fatG: 100,
    });
  });

  it('met à l’échelle pour plusieurs portions', () => {
    expect(snapshotForRecipe(SIMPLE, 2).kcal).toBe(1768);
    expect(snapshotForRecipe(SIMPLE, 2).fatG).toBe(200);
  });

  it('accepte une demi-portion', () => {
    expect(snapshotForRecipe(SIMPLE, 0.5).kcal).toBe(442);
  });

  it('porte le nom de la recette, pour rester lisible sans elle', () => {
    // L'entrée ne référence pas la recette : le nom figé est tout ce qui
    // restera si le catalogue change à la mise à jour suivante.
    expect(snapshotForRecipe(recipe('red_lentil_dahl')).name).toBe('Dahl de lentilles corail');
  });

  it('produit la forme exacte attendue par le journal', () => {
    const snapshot = snapshotForRecipe(recipe('tuna_wrap'));

    expect(Object.keys(snapshot).sort()).toEqual(['carbsG', 'fatG', 'kcal', 'name', 'proteinG']);
    expect(Number.isInteger(snapshot.kcal)).toBe(true);
  });

  it('refuse un nombre de portions absurde', () => {
    expect(() => snapshotForRecipe(SIMPLE, 0)).toThrow(InvalidInputError);
    expect(() => snapshotForRecipe(SIMPLE, -2)).toThrow(InvalidInputError);
  });
});

describe('portionWeightG', () => {
  it('donne le poids à enregistrer pour une portion', () => {
    expect(portionWeightG(SIMPLE)).toBe(100);
  });

  it('suit le nombre de portions', () => {
    expect(portionWeightG(SIMPLE, 2)).toBe(200);
    expect(portionWeightG(SIMPLE, 0.5)).toBe(50);
  });

  it('refuse un nombre de portions absurde', () => {
    expect(() => portionWeightG(SIMPLE, 0)).toThrow(InvalidInputError);
  });
});

describe('cohérence sur le catalogue réel', () => {
  it('donne à chaque recette une portion nourrissante mais plausible', () => {
    for (const candidate of RECIPES) {
      const { nutritionPerServing, name } = resolveRecipe(candidate);

      // Bornes larges : on cherche l'erreur de saisie (portion à 3 000 kcal),
      // pas à juger l'équilibre du plat.
      expect(nutritionPerServing.kcal).toBeGreaterThan(80);
      expect(nutritionPerServing.kcal).toBeLessThan(1000);
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('somme les portions au total de la recette, aux arrondis près', () => {
    for (const candidate of RECIPES) {
      const totals = recipeTotals(candidate);
      const resolved = resolveRecipe(candidate);
      const rebuilt = resolved.nutritionPerServing.kcal * candidate.servings;

      expect(Math.abs(rebuilt - totals.kcal)).toBeLessThanOrEqual(candidate.servings);
    }
  });
});
