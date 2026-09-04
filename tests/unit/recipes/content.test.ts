import { matchesIngredientName } from '@/domain/recipes/allergens';
import {
  COMMON_DISLIKE_SUGGESTIONS,
  DISLIKE_SUGGESTION_IDS,
  INGREDIENTS,
  INGREDIENTS_BY_ID,
} from '@/domain/recipes/content/ingredients';
import { RECIPES } from '@/domain/recipes/content/recipes';
import { resolveRecipe } from '@/domain/recipes/nutrition';
import { ALLERGENS } from '@/domain/recipes/types';

/**
 * Intégrité du catalogue.
 *
 * Le contenu est transcrit à la main : ce sont ces tests, et non le typage, qui
 * empêchent une quantité oubliée ou un identifiant mal recopié de passer.
 */
describe('table d’ingrédients', () => {
  it('n’a aucun identifiant en double', () => {
    const ids = INGREDIENTS.map((ingredient) => ingredient.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(INGREDIENTS_BY_ID.size).toBe(INGREDIENTS.length);
  });

  it('donne à chaque ingrédient un nom et des valeurs exploitables', () => {
    for (const ingredient of INGREDIENTS) {
      expect(ingredient.name.length).toBeGreaterThan(0);
      expect(ingredient.per100g.kcal).toBeGreaterThanOrEqual(0);
      expect(ingredient.per100g.proteinG).toBeGreaterThanOrEqual(0);
      expect(ingredient.per100g.carbsG).toBeGreaterThanOrEqual(0);
      expect(ingredient.per100g.fatG).toBeGreaterThanOrEqual(0);
    }
  });

  it('n’emploie que des allergènes du vocabulaire fermé', () => {
    for (const ingredient of INGREDIENTS) {
      for (const allergen of ingredient.allergens) {
        expect(ALLERGENS).toContain(allergen);
      }
    }
  });

  /**
   * Contrôle de transcription, pas audit nutritionnel : les calories doivent
   * rester dans le voisinage de ce que donnent les macros par le système
   * Atwater (4 kcal/g pour protéines et glucides, 9 pour les lipides). Un
   * chiffre décalé d'un rang s'y voit immédiatement.
   *
   * La tolérance est large parce que l'écart est **attendu** sur les végétaux :
   * les fibres sont comptées dans les glucides mais n'apportent qu'environ
   * 2 kcal/g, si bien qu'Atwater surestime systématiquement un brocoli ou un
   * concombre. La vérification fine des valeurs relève de la comparaison avec
   * une base officielle, qui reste à faire.
   */
  it('a des calories dans le voisinage de ses macronutriments', () => {
    for (const ingredient of INGREDIENTS) {
      const { kcal, proteinG, carbsG, fatG } = ingredient.per100g;
      const fromMacros = proteinG * 4 + carbsG * 4 + fatG * 9;

      if (kcal === 0) {
        expect(fromMacros).toBe(0);
        continue;
      }

      expect(Math.abs(fromMacros - kcal) / kcal).toBeLessThan(0.3);
    }
  });

  /**
   * Les suggestions d'aliments détestés doivent pouvoir écarter quelque chose.
   * Les six proposées avant la Phase 7 — coriandre, champignons, olives, foie,
   * chou, anchois — ne correspondaient à aucun ingrédient : les cocher n'avait
   * aucun effet, et rien ne le signalait.
   */
  it('ne propose que des aliments détestés que le catalogue peut écarter', () => {
    expect(COMMON_DISLIKE_SUGGESTIONS).toHaveLength(DISLIKE_SUGGESTION_IDS.length);

    for (const suggestion of COMMON_DISLIKE_SUGGESTIONS) {
      const matching = INGREDIENTS.filter((ingredient) =>
        matchesIngredientName(suggestion, ingredient.name),
      );

      expect(matching.length).toBeGreaterThan(0);
    }
  });

  it('ne suggère que des aliments réellement utilisés par une recette', () => {
    const used = new Set(RECIPES.flatMap((r) => r.ingredients.map(({ refId }) => refId)));

    for (const id of DISLIKE_SUGGESTION_IDS) {
      expect(used.has(id)).toBe(true);
    }
  });

  it('précise l’état de référence de chaque ingrédient', () => {
    // Cru ou cuit change tout : 100 g de riz cru ne sont pas 100 g de riz cuit.
    for (const ingredient of INGREDIENTS) {
      expect(['raw', 'cooked', 'as_sold']).toContain(ingredient.state);
    }
  });
});

describe('catalogue de recettes', () => {
  it('compte les 22 recettes du catalogue rédigé', () => {
    expect(RECIPES).toHaveLength(22);
  });

  it('n’a aucun identifiant en double', () => {
    const ids = RECIPES.map((recipe) => recipe.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ne référence que des ingrédients connus', () => {
    // Un identifiant mal recopié ferait échouer la recette à l'affichage :
    // autant l'apprendre ici.
    for (const recipe of RECIPES) {
      for (const ingredient of recipe.ingredients) {
        expect(INGREDIENTS_BY_ID.has(ingredient.refId)).toBe(true);
      }
    }
  });

  it('donne à chaque recette des quantités, des étapes et des portions utilisables', () => {
    for (const recipe of RECIPES) {
      expect(recipe.name.length).toBeGreaterThan(0);
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      expect(recipe.steps.length).toBeGreaterThan(0);
      expect(recipe.servings).toBeGreaterThan(0);
      expect(recipe.prepTimeMin).toBeGreaterThan(0);
      expect(recipe.mealTypes.length).toBeGreaterThan(0);

      for (const ingredient of recipe.ingredients) {
        expect(ingredient.quantityG).toBeGreaterThan(0);
      }
    }
  });

  it('n’a aucun ingrédient répété dans une même recette', () => {
    for (const recipe of RECIPES) {
      const refIds = recipe.ingredients.map((ingredient) => ingredient.refId);

      expect(new Set(refIds).size).toBe(refIds.length);
    }
  });

  it('couvre les quatre moments de la journée', () => {
    const covered = new Set(RECIPES.flatMap((recipe) => recipe.mealTypes));

    expect([...covered].sort()).toEqual(['breakfast', 'dinner', 'lunch', 'snack']);
  });

  it('se résout intégralement, sans exception', () => {
    for (const recipe of RECIPES) {
      expect(() => resolveRecipe(recipe)).not.toThrow();
    }
  });

  it('propose au moins une recette à chaque régime, pour chaque repas', () => {
    const resolved = RECIPES.map(resolveRecipe);

    for (const diet of ['omnivore', 'flexitarian', 'pescatarian', 'vegetarian', 'vegan'] as const) {
      for (const mealType of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
        const matching = resolved.filter(
          (recipe) => recipe.dietTypes.includes(diet) && recipe.mealTypes.includes(mealType),
        );

        expect(matching.length).toBeGreaterThan(0);
      }
    }
  });

  it('ne contient aucune recette sans régime compatible', () => {
    for (const recipe of RECIPES.map(resolveRecipe)) {
      expect(recipe.dietTypes.length).toBeGreaterThan(0);
    }
  });
});
