import { fireEvent } from '@testing-library/react-native';

import MealsScreen from '@/app/meals/index';
import NewMealScreen from '@/app/meals/new';
import { snapshotForMeal, totalMealWeightG } from '@/domain/journal/snapshot';
import { useSessionStore } from '@/stores/session';

import { buildFoodItem, buildStoredProfile } from '../integration/helpers/fixtures';
import { createAppHarness, type AppHarness } from '../support/render-with-app';
import { routerMock } from '../support/router-mock';

const TODAY = '2026-03-15';

/**
 * Repas prédéfinis.
 *
 * Fonctionnalité entièrement locale : ces tests mettent la source distante hors
 * ligne d'emblée, pour prouver qu'aucun chemin n'en dépend.
 */
describe('repas prédéfinis', () => {
  let harness: AppHarness;

  beforeEach(() => {
    harness = createAppHarness();
    harness.repositories.profile.save(buildStoredProfile());
    useSessionStore.getState().setSelectedDate(TODAY);
    harness.foodSource.goOffline();
  });

  afterEach(() => {
    harness.cleanup();
  });

  function givenFood(id: string, name: string, kcal: number) {
    return harness.repositories.food.upsert(
      buildFoodItem({
        id,
        name,
        source: 'custom',
        verified: true,
        nutritionPer100: { kcal, proteinG: 10, carbsG: 20, fatG: 5 },
      }),
    );
  }

  function givenMeal() {
    const rice = givenFood('custom-rice', 'Riz basmati', 130);
    const chicken = givenFood('custom-chicken', 'Blanc de poulet', 165);

    return harness.repositories.meal.create({
      name: 'Bol du midi',
      items: [
        { foodItemId: rice.id, quantityG: 150 },
        { foodItemId: chicken.id, quantityG: 120 },
      ],
    });
  }

  describe('composition', () => {
    it('assemble un repas à partir des aliments connus localement', async () => {
      givenFood('custom-rice', 'Riz basmati', 130);

      const screen = await harness.renderScreen(<NewMealScreen />);
      await fireEvent.changeText(screen.getByTestId('meal-new-name'), 'Bol du midi');
      await fireEvent.changeText(screen.getByTestId('meal-new-search'), 'riz');
      await fireEvent.press(screen.getByTestId('meal-new-add-custom-rice'));
      await fireEvent.press(screen.getByTestId('meal-new-submit'));

      const [meal] = harness.repositories.meal.listAll();
      expect(meal?.name).toBe('Bol du midi');
      expect(meal?.items).toEqual([{ foodItemId: 'custom-rice', quantityG: 100 }]);
    });

    it('laisse ajuster la quantité de chaque composant', async () => {
      givenFood('custom-rice', 'Riz basmati', 130);

      const screen = await harness.renderScreen(<NewMealScreen />);
      await fireEvent.changeText(screen.getByTestId('meal-new-name'), 'Bol');
      await fireEvent.changeText(screen.getByTestId('meal-new-search'), 'riz');
      await fireEvent.press(screen.getByTestId('meal-new-add-custom-rice'));
      await fireEvent.changeText(screen.getByTestId('meal-new-quantity-custom-rice'), '180');
      await fireEvent.press(screen.getByTestId('meal-new-submit'));

      expect(harness.repositories.meal.listAll()[0]?.items[0]?.quantityG).toBe(180);
    });

    it('refuse un repas sans nom ou sans composant', async () => {
      const screen = await harness.renderScreen(<NewMealScreen />);

      expect(screen.getByTestId('meal-new-submit').props.accessibilityState.disabled).toBe(true);
    });

    it('n’ajoute pas deux fois le même aliment', async () => {
      givenFood('custom-rice', 'Riz basmati', 130);

      const screen = await harness.renderScreen(<NewMealScreen />);
      await fireEvent.changeText(screen.getByTestId('meal-new-search'), 'riz');
      await fireEvent.press(screen.getByTestId('meal-new-add-custom-rice'));
      await fireEvent.changeText(screen.getByTestId('meal-new-search'), 'riz');
      await fireEvent.press(screen.getByTestId('meal-new-add-custom-rice'));
      await fireEvent.changeText(screen.getByTestId('meal-new-name'), 'Bol');
      await fireEvent.press(screen.getByTestId('meal-new-submit'));

      expect(harness.repositories.meal.listAll()[0]?.items).toHaveLength(1);
    });

    it('oriente vers la recherche quand l’aliment n’est pas encore local', async () => {
      // Un repas dont un ingrédient n'est pas en cache ne pourrait pas être
      // rejoué hors ligne : autant le dire tout de suite.
      const screen = await harness.renderScreen(<NewMealScreen />);
      await fireEvent.changeText(screen.getByTestId('meal-new-search'), 'quinoa');

      expect(screen.getByTestId('meal-new-no-local')).toHaveTextContent(/écran de\s+recherche/);
    });
  });

  describe('rejeu en un tap', () => {
    it('journalise le repas avec le snapshot du domaine', async () => {
      const meal = givenMeal();

      const screen = await harness.renderScreen(<MealsScreen />);
      await fireEvent.press(screen.getByTestId(`meal-${meal.id}-replay`));
      await fireEvent.press(screen.getByTestId(`meal-${meal.id}-to-lunch`));

      const [entry] = harness.repositories.foodLog.getByDate(TODAY);
      expect(entry?.snapshot).toEqual(
        snapshotForMeal(meal, (id) => harness.repositories.food.getById(id)),
      );
      expect(entry?.quantityG).toBe(totalMealWeightG(meal));
      expect(entry?.mealId).toBe(meal.id);
      expect(entry?.mealType).toBe('lunch');
    });

    it('fonctionne entièrement hors ligne', async () => {
      const meal = givenMeal();

      const screen = await harness.renderScreen(<MealsScreen />);
      await fireEvent.press(screen.getByTestId(`meal-${meal.id}-replay`));
      await fireEvent.press(screen.getByTestId(`meal-${meal.id}-to-dinner`));

      expect(harness.repositories.foodLog.getByDate(TODAY)).toHaveLength(1);
      expect(harness.foodSource.calls.search + harness.foodSource.calls.lookup).toBe(0);
      expect(routerMock.replace).toHaveBeenCalledWith('/');
    });

    it('refuse de journaliser un repas amputé, et le dit', async () => {
      // Mieux vaut un message qu'un total silencieusement faux.
      const meal = givenMeal();
      harness.repositories.food.remove('custom-chicken');

      const screen = await harness.renderScreen(<MealsScreen />);
      await fireEvent.press(screen.getByTestId(`meal-${meal.id}-replay`));
      await fireEvent.press(screen.getByTestId(`meal-${meal.id}-to-lunch`));

      expect(screen.getByTestId('meals-failure')).toHaveTextContent(/n’est plus disponible/);
      expect(harness.repositories.foodLog.getByDate(TODAY)).toEqual([]);
    });

    it('signale une composition incomplète dans la liste, sans planter', async () => {
      const meal = givenMeal();
      harness.repositories.food.remove('custom-rice');

      const screen = await harness.renderScreen(<MealsScreen />);

      expect(screen.getByTestId(`meal-${meal.id}`)).toHaveTextContent(/Composition incomplète/);
    });
  });

  it('explique quoi faire quand aucun repas n’existe', async () => {
    const screen = await harness.renderScreen(<MealsScreen />);

    expect(screen.getByTestId('meals-empty')).toBeTruthy();
    expect(screen.getByTestId('meals-create')).toBeTruthy();
  });
});
