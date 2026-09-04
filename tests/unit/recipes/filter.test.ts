import {
  ALLERGEN_CHOICES,
  ALLERGEN_LABELS,
  matchesIngredientName,
  resolveAllergies,
} from '@/domain/recipes/allergens';
import { RECIPES } from '@/domain/recipes/content/recipes';
import { filterRecipes } from '@/domain/recipes/filter';
import { resolveRecipe } from '@/domain/recipes/nutrition';
import { ALLERGENS } from '@/domain/recipes/types';

import { buildProfile } from '../profile-fixtures';

const ids = (recipes: readonly { id: string }[]) => recipes.map((recipe) => recipe.id);

describe('resolveAllergies', () => {
  it('reconnaît les libellés proposés à l’onboarding', () => {
    // Le vocabulaire est fermé : chaque puce doit se traduire, sans exception.
    for (const allergen of ALLERGENS) {
      expect(resolveAllergies([ALLERGEN_LABELS[allergen]]).allergens).toEqual([allergen]);
    }
  });

  it('propose exactement les neuf allergènes suivis', () => {
    expect(ALLERGEN_CHOICES).toHaveLength(ALLERGENS.length);
    expect(ALLERGEN_CHOICES).toContain('Sésame');
  });

  it('reconnaît les libellés des versions antérieures', () => {
    // Un profil créé avant la fermeture du vocabulaire doit rester protégé.
    expect(resolveAllergies(['Arachide']).allergens).toEqual(['peanuts']);
    expect(resolveAllergies(['Lactose']).allergens).toEqual(['dairy']);
    expect(resolveAllergies(['Œuf']).allergens).toEqual(['eggs']);
  });

  it('ignore la casse et les accents', () => {
    expect(resolveAllergies(['SÉSAME']).allergens).toEqual(['sesame']);
    expect(resolveAllergies(['sesame']).allergens).toEqual(['sesame']);
    expect(resolveAllergies(['  Œufs  ']).allergens).toEqual(['eggs']);
    expect(resolveAllergies(['oeufs']).allergens).toEqual(['eggs']);
  });

  it('reconnaît les synonymes courants', () => {
    expect(resolveAllergies(['cacahuètes']).allergens).toEqual(['peanuts']);
    expect(resolveAllergies(['Fruits de mer']).allergens).toEqual(['shellfish']);
  });

  it('remonte ce qu’il ne sait pas traduire, plutôt que de l’ignorer', () => {
    const resolved = resolveAllergies(['Arachides', 'Kiwi']);

    expect(resolved.allergens).toEqual(['peanuts']);
    expect(resolved.unrecognised).toEqual(['Kiwi']);
  });

  it('ne compte pas une saisie vide comme une allergie inconnue', () => {
    expect(resolveAllergies(['   ']).unrecognised).toEqual([]);
  });

  it('dédoublonne deux formulations du même allergène', () => {
    expect(resolveAllergies(['Lait', 'Lactose']).allergens).toEqual(['dairy']);
  });

  it('renvoie les allergènes dans un ordre stable', () => {
    expect(resolveAllergies(['Soja', 'Gluten']).allergens).toEqual(
      resolveAllergies(['Gluten', 'Soja']).allergens,
    );
  });
});

describe('matchesIngredientName', () => {
  it('reconnaît un nom malgré la casse et les accents', () => {
    expect(matchesIngredientName('oignon', 'Oignon')).toBe(true);
    expect(matchesIngredientName('EPINARDS', 'Épinards frais')).toBe(true);
  });

  it('accepte une correspondance partielle', () => {
    expect(matchesIngredientName('tomate', 'Tomate')).toBe(true);
  });

  it('ne rapproche pas deux aliments différents', () => {
    expect(matchesIngredientName('poulet', 'Tofu ferme')).toBe(false);
  });

  it('ignore une saisie vide', () => {
    expect(matchesIngredientName('  ', 'Tomate')).toBe(false);
  });
});

/**
 * L'exclusion des allergènes est la seule règle que la spécification qualifie
 * de non négociable : ces tests-là ne sont pas des tests de confort.
 */
describe('filterRecipes — exclusion des allergènes', () => {
  it('ne propose aucune recette contenant un allergène déclaré', () => {
    const { recipes } = filterRecipes({
      profile: buildProfile({ allergies: ['Gluten'], dietType: 'omnivore' }),
    });

    for (const recipe of recipes) {
      expect(recipe.allergens).not.toContain('gluten');
    }

    expect(ids(recipes)).not.toContain('greek_yogurt_granola');
    expect(ids(recipes)).not.toContain('tuna_wrap');
  });

  it('exclut sur chacun des neuf allergènes suivis', () => {
    for (const allergen of ALLERGENS) {
      const { recipes } = filterRecipes({
        profile: buildProfile({ allergies: [ALLERGEN_LABELS[allergen]], dietType: 'omnivore' }),
      });

      for (const recipe of recipes) {
        expect(recipe.allergens).not.toContain(allergen);
      }
    }
  });

  it('exclut le houmous pour une allergie au sésame', () => {
    const { recipes } = filterRecipes({
      profile: buildProfile({ allergies: ['Sésame'], dietType: 'omnivore' }),
    });

    expect(ids(recipes)).not.toContain('hummus_veggie_sticks');
  });

  it('cumule plusieurs allergies', () => {
    const { recipes } = filterRecipes({
      profile: buildProfile({ allergies: ['Gluten', 'Lait'], dietType: 'omnivore' }),
    });

    for (const recipe of recipes) {
      expect(recipe.allergens).not.toContain('gluten');
      expect(recipe.allergens).not.toContain('dairy');
    }
  });

  it('signale une allergie qu’il ne sait pas traduire, sans la taire', () => {
    const result = filterRecipes({
      profile: buildProfile({ allergies: ['Kiwi'], dietType: 'omnivore' }),
    });

    expect(result.unrecognisedAllergies).toEqual(['Kiwi']);
    // Les recettes restent proposées : c'est l'écran qui doit prévenir.
    expect(result.recipes.length).toBeGreaterThan(0);
  });

  it('ne signale rien quand tout est compris', () => {
    expect(
      filterRecipes({ profile: buildProfile({ allergies: ['Gluten'] }) }).unrecognisedAllergies,
    ).toEqual([]);
  });
});

describe('filterRecipes — régime', () => {
  it('ne propose que des recettes compatibles', () => {
    for (const dietType of ['vegan', 'vegetarian', 'pescatarian', 'flexitarian'] as const) {
      const { recipes } = filterRecipes({ profile: buildProfile({ dietType, allergies: [] }) });

      expect(recipes.length).toBeGreaterThan(0);

      for (const recipe of recipes) {
        expect(recipe.dietTypes).toContain(dietType);
      }
    }
  });

  it('ne sert jamais de viande à un pescatarien', () => {
    const { recipes } = filterRecipes({
      profile: buildProfile({ dietType: 'pescatarian', allergies: [] }),
    });

    expect(ids(recipes)).not.toContain('chicken_quinoa_salad');
    expect(ids(recipes)).not.toContain('beef_greenbeans_potato');
    // Le poisson, lui, reste au menu.
    expect(ids(recipes)).toContain('salmon_sweet_potato');
  });

  it('ne sert ni miel ni laitage à un végétalien', () => {
    const { recipes } = filterRecipes({
      profile: buildProfile({ dietType: 'vegan', allergies: [] }),
    });

    expect(ids(recipes)).not.toContain('skyr_berries_oats');
    expect(ids(recipes)).not.toContain('fromage_blanc_honey_walnuts');
  });
});

describe('filterRecipes — aliments détestés et temps', () => {
  it('écarte une recette contenant un aliment détesté', () => {
    const { recipes } = filterRecipes({
      profile: buildProfile({ dislikes: ['Oignon'], allergies: [] }),
    });

    expect(ids(recipes)).not.toContain('red_lentil_dahl');
    expect(ids(recipes)).not.toContain('chili_sin_carne');
  });

  it('n’écarte rien pour un aliment absent de la table', () => {
    // Limite assumée : un aliment détesté qu'aucun ingrédient ne nomme ne peut
    // pas être repéré. Sans conséquence de sécurité.
    const all = filterRecipes({ profile: buildProfile({ dislikes: [], allergies: [] }) });
    const withDislike = filterRecipes({
      profile: buildProfile({ dislikes: ['Coriandre'], allergies: [] }),
    });

    expect(withDislike.recipes).toHaveLength(all.recipes.length);
  });

  it('respecte le temps disponible', () => {
    const { recipes } = filterRecipes({
      profile: buildProfile({ allergies: [] }),
      maxPrepTimeMin: 5,
    });

    expect(recipes.length).toBeGreaterThan(0);

    for (const recipe of recipes) {
      expect(recipe.prepTimeMin).toBeLessThanOrEqual(5);
    }
  });
});

describe('filterRecipes — ordre', () => {
  it('remonte les recettes du moment de la journée', () => {
    const { recipes } = filterRecipes({
      profile: buildProfile({ allergies: [] }),
      mealType: 'breakfast',
    });

    expect(recipes[0].mealTypes).toContain('breakfast');
  });

  it('privilégie les recettes protéinées en perte de poids', () => {
    const { recipes } = filterRecipes({
      profile: buildProfile({ goalType: 'weight_loss', allergies: [] }),
      mealType: 'dinner',
    });

    expect(recipes[0].tags).toContain('high_protein');
  });

  it('privilégie aussi les protéines en recomposition', () => {
    // Même message que les briques de conseil : les protéines protègent la
    // masse maigre, en perte comme en recomposition.
    const { recipes } = filterRecipes({
      profile: buildProfile({ goalType: 'recomposition', allergies: [] }),
      mealType: 'dinner',
    });

    expect(recipes[0].tags).toContain('high_protein');
  });

  it('ne valorise pas les recettes hypocaloriques en recomposition', () => {
    // Manger peu n'est pas le but quand on cherche à reconstruire du muscle :
    // seule la perte de poids met `low_calorie` en avant.
    const recomposition = filterRecipes({
      profile: buildProfile({ goalType: 'recomposition', allergies: [] }),
      mealType: 'dinner',
    });
    const loss = filterRecipes({
      profile: buildProfile({ goalType: 'weight_loss', allergies: [] }),
      mealType: 'dinner',
    });

    expect(ids(recomposition.recipes)).not.toEqual(ids(loss.recipes));
  });

  it('n’oriente pas l’assiette de quelqu’un qui se maintient', () => {
    const maintenance = filterRecipes({
      profile: buildProfile({ goalType: 'maintenance', allergies: [] }),
    });
    const loss = filterRecipes({
      profile: buildProfile({ goalType: 'weight_loss', allergies: [] }),
    });

    // Même catalogue retenu, ordre différent : seul le classement change.
    expect(ids(maintenance.recipes).sort()).toEqual(ids(loss.recipes).sort());
    expect(ids(maintenance.recipes)).not.toEqual(ids(loss.recipes));
  });

  it('est déterministe : mêmes entrées, même ordre', () => {
    const input = { profile: buildProfile({ allergies: [] }), mealType: 'lunch' as const };

    expect(ids(filterRecipes(input).recipes)).toEqual(ids(filterRecipes(input).recipes));
  });

  it('ne dépend pas de l’ordre du catalogue', () => {
    const profile = buildProfile({ allergies: [] });
    const reversed = [...RECIPES].reverse();

    expect(ids(filterRecipes({ profile, recipes: reversed }).recipes)).toEqual(
      ids(filterRecipes({ profile }).recipes),
    );
  });

  it('renvoie des recettes résolues, prêtes à afficher', () => {
    const [first] = filterRecipes({ profile: buildProfile({ allergies: [] }) }).recipes;

    expect(first.nutritionPerServing.kcal).toBeGreaterThan(0);
    expect(first.dietTypes.length).toBeGreaterThan(0);
    expect(first).toEqual(resolveRecipe(RECIPES.find(({ id }) => id === first.id) as never));
  });

  it('peut ne rien renvoyer sans se plaindre', () => {
    const { recipes } = filterRecipes({
      profile: buildProfile({ dietType: 'vegan', allergies: ['Gluten', 'Soja'] }),
      maxPrepTimeMin: 1,
    });

    expect(recipes).toEqual([]);
  });
});
