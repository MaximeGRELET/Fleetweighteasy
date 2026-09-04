import { fireEvent } from '@testing-library/react-native';

import RecipeDetailScreen from '@/app/recipes/[id]';
import RecipesScreen from '@/app/recipes/index';
import type { UserProfile } from '@/domain/profile/types';
import { RECIPES } from '@/domain/recipes/content/recipes';
import { resolveRecipe } from '@/domain/recipes/nutrition';
import { todayIsoDate } from '@/stores/session';

import { buildStoredProfile } from '../integration/helpers/fixtures';
import { createAppHarness, type AppHarness } from '../support/render-with-app';
import { routerMock, setLocalSearchParams } from '../support/router-mock';

/**
 * Recettes, vues depuis les écrans.
 *
 * Ces tests portent sur ce que la Phase 7 exige de visible : un catalogue
 * filtré sur le profil, l'exclusion des allergènes garantie, et l'ajout au
 * journal produisant une entrée ordinaire (PHASES_6_A_10 §7.8).
 */
describe('recettes', () => {
  let harness: AppHarness;
  const today = todayIsoDate();

  beforeEach(() => {
    harness = createAppHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  function givenProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    const profile = buildStoredProfile({ allergies: [], dislikes: [], ...overrides });
    harness.repositories.profile.save(profile);
    return profile;
  }

  describe('liste', () => {
    it('affiche des recettes adaptées au profil', async () => {
      givenProfile({ dietType: 'omnivore' });

      const screen = await harness.renderScreen(<RecipesScreen />);

      expect(screen.getByTestId('recipe-red_lentil_dahl')).toBeTruthy();
      expect(screen.queryByTestId('recipes-empty')).toBeNull();
    });

    /** L'exclusion des allergènes est la règle dure de la phase. */
    it('ne montre jamais une recette contenant un allergène déclaré', async () => {
      givenProfile({ allergies: ['Sésame'] });

      const screen = await harness.renderScreen(<RecipesScreen />);

      expect(screen.queryByTestId('recipe-hummus_veggie_sticks')).toBeNull();
    });

    it('exclut aussi sur un libellé d’une version antérieure', async () => {
      // Un profil créé avant la fermeture du vocabulaire reste protégé.
      givenProfile({ allergies: ['Arachide'] });

      const screen = await harness.renderScreen(<RecipesScreen />);

      expect(screen.queryByTestId('recipe-apple_peanut_butter')).toBeNull();
    });

    it('prévient quand une allergie ne peut pas être prise en compte', async () => {
      givenProfile({ allergies: ['Kiwi'] });

      const screen = await harness.renderScreen(<RecipesScreen />);

      expect(screen.getByTestId('recipes-unrecognised-allergies')).toHaveTextContent(/Kiwi/);
    });

    it('ne prévient de rien quand tout est compris', async () => {
      givenProfile({ allergies: ['Gluten'] });

      const screen = await harness.renderScreen(<RecipesScreen />);

      expect(screen.queryByTestId('recipes-unrecognised-allergies')).toBeNull();
    });

    it('respecte le régime', async () => {
      givenProfile({ dietType: 'pescatarian' });

      const screen = await harness.renderScreen(<RecipesScreen />);

      expect(screen.queryByTestId('recipe-chicken_quinoa_salad')).toBeNull();
      expect(screen.getByTestId('recipe-salmon_sweet_potato')).toBeTruthy();
    });

    it('affiche les allergènes d’une recette, même non concernés', async () => {
      // On cuisine souvent pour d'autres que soi.
      givenProfile({ dietType: 'omnivore' });

      const screen = await harness.renderScreen(<RecipesScreen />);

      expect(screen.getByTestId('recipe-hummus_veggie_sticks-allergens')).toHaveTextContent(
        /Sésame/,
      );
    });

    it('filtre par moment de la journée sans vider la liste', async () => {
      givenProfile({ dietType: 'omnivore' });

      const screen = await harness.renderScreen(<RecipesScreen />);
      await fireEvent.press(screen.getByTestId('recipes-filter-breakfast'));

      expect(screen.getByTestId('recipe-skyr_berries_oats')).toBeTruthy();
    });

    it('propose le choix du repas en rôle exclusif', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<RecipesScreen />);

      expect(screen.getByTestId('recipes-filter-lunch').props.accessibilityRole).toBe('radio');
    });

    it('ouvre le détail d’une recette', async () => {
      givenProfile({ dietType: 'omnivore' });

      const screen = await harness.renderScreen(<RecipesScreen />);
      await fireEvent.press(screen.getByTestId('recipe-red_lentil_dahl'));

      expect(routerMock.push).toHaveBeenCalledWith({
        pathname: '/recipes/[id]',
        params: { id: 'red_lentil_dahl' },
      });
    });
  });

  describe('détail', () => {
    beforeEach(() => {
      setLocalSearchParams({ id: 'red_lentil_dahl' });
    });

    it('affiche ingrédients, étapes et nutrition par portion', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<RecipeDetailScreen />);
      const expected = resolveRecipe(RECIPES.find(({ id }) => id === 'red_lentil_dahl') as never);

      expect(screen.getByTestId('ingredient-lentils_raw')).toBeTruthy();
      expect(screen.getByTestId('recipe-nutrition')).toHaveTextContent(
        new RegExp(String(expected.nutritionPerServing.kcal)),
      );
      expect(screen.getByTestId('recipe-step-0')).toHaveTextContent(/Fais revenir l’oignon/);
      expect(screen.getByTestId('recipe-step-0')).toHaveTextContent(/^1\./);
    });

    it('précise l’état des ingrédients, cru ou cuit', async () => {
      // 100 g de riz cru ne sont pas 100 g de riz cuit : peser au mauvais
      // moment fausserait la journée d'un facteur trois.
      givenProfile();

      const screen = await harness.renderScreen(<RecipeDetailScreen />);

      expect(screen.getByTestId('ingredient-lentils_raw')).toHaveTextContent(/cru/);
    });

    it('signale une recette absente du catalogue plutôt que de planter', async () => {
      setLocalSearchParams({ id: 'recette_supprimee' });
      givenProfile();

      const screen = await harness.renderScreen(<RecipeDetailScreen />);

      expect(screen.getByTestId('recipe-unknown')).toBeTruthy();
    });
  });

  describe('ajout au journal', () => {
    beforeEach(() => {
      setLocalSearchParams({ id: 'red_lentil_dahl' });
    });

    it('crée une entrée de journal ordinaire', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<RecipeDetailScreen />);
      await fireEvent.press(screen.getByTestId('recipe-log-dinner'));

      const [entry] = harness.repositories.foodLog.getByDate(today);
      const expected = resolveRecipe(RECIPES.find(({ id }) => id === 'red_lentil_dahl') as never);

      expect(entry.mealType).toBe('dinner');
      expect(entry.snapshot.name).toBe('Dahl de lentilles corail');
      expect(entry.snapshot.kcal).toBe(expected.nutritionPerServing.kcal);
    });

    it('fige les valeurs, comme pour un produit du catalogue distant', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<RecipeDetailScreen />);
      await fireEvent.press(screen.getByTestId('recipe-log-lunch'));

      const [entry] = harness.repositories.foodLog.getByDate(today);

      // Aucune source référencée : le snapshot est ce qui restera si le
      // catalogue change à la mise à jour suivante.
      expect(entry.foodItemId).toBeUndefined();
      expect(entry.mealId).toBeUndefined();
      expect(entry.snapshot.proteinG).toBeGreaterThan(0);
      expect(entry.quantityG).toBeGreaterThan(0);
    });

    it('entre dans les totaux du jour comme n’importe quelle entrée', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<RecipeDetailScreen />);
      await fireEvent.press(screen.getByTestId('recipe-log-dinner'));

      const totals = harness.repositories.foodLog.getDailyTotals(today);
      const [entry] = harness.repositories.foodLog.getByDate(today);

      expect(totals.kcal).toBe(entry.snapshot.kcal);
    });

    it('met à l’échelle selon le nombre de portions', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<RecipeDetailScreen />);
      await fireEvent.press(screen.getByTestId('recipe-portions-more'));
      await fireEvent.press(screen.getByTestId('recipe-log-dinner'));

      const [entry] = harness.repositories.foodLog.getByDate(today);
      const expected = resolveRecipe(RECIPES.find(({ id }) => id === 'red_lentil_dahl') as never);

      // 1,5 portion.
      expect(entry.snapshot.kcal).toBe(Math.round(expected.nutritionPerServing.kcal * 1.5));
    });

    it('ne descend jamais sous une demi-portion', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<RecipeDetailScreen />);
      await fireEvent.press(screen.getByTestId('recipe-portions-less'));
      await fireEvent.press(screen.getByTestId('recipe-portions-less'));

      expect(screen.getByTestId('recipe-portions')).toHaveTextContent(/0.5/);
    });

    it('confirme l’ajout à l’écran', async () => {
      givenProfile();

      const screen = await harness.renderScreen(<RecipeDetailScreen />);
      await fireEvent.press(screen.getByTestId('recipe-log-breakfast'));

      expect(screen.getByTestId('recipe-logged')).toHaveTextContent(/petit-déjeuner/);
    });
  });
});
