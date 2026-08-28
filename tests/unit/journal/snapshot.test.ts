import { InvalidInputError } from '@/domain/errors';
import type { FoodItem, Meal } from '@/domain/food/types';
import {
  snapshotForFoodItem,
  snapshotForMeal,
  sumDailyTotals,
  totalMealWeightG,
} from '@/domain/journal/snapshot';
import type { FoodLogEntry, NutritionSnapshot } from '@/domain/journal/types';

function buildItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'food-riz',
    source: 'off',
    name: 'Riz basmati cuit',
    brand: 'Marque Test',
    nutritionPer100: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4 },
    servingSizes: [],
    verified: false,
    cachedAt: '2026-03-15T08:00:00.000Z',
    ...overrides,
  };
}

function buildEntry(snapshot: Partial<NutritionSnapshot>): FoodLogEntry {
  return {
    id: 'e1',
    date: '2026-03-15',
    mealType: 'lunch',
    quantityG: 100,
    loggedAt: '2026-03-15T12:00:00.000Z',
    snapshot: { name: 'Test', kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, ...snapshot },
  };
}

describe('snapshotForFoodItem', () => {
  it('proportionne les valeurs à la quantité', () => {
    expect(snapshotForFoodItem(buildItem(), 150)).toEqual({
      name: 'Riz basmati cuit (Marque Test)',
      kcal: 195,
      proteinG: 4.1,
      carbsG: 42,
      fatG: 0.5,
      fiberG: 0.6,
    });
  });

  it('reprend les valeurs telles quelles pour 100 g', () => {
    const snapshot = snapshotForFoodItem(buildItem(), 100);

    expect(snapshot.kcal).toBe(130);
    expect(snapshot.carbsG).toBe(28);
  });

  it('omet la marque quand il n’y en a pas', () => {
    expect(snapshotForFoodItem(buildItem({ brand: undefined }), 100).name).toBe('Riz basmati cuit');
  });

  it('n’invente pas de fibres quand la source n’en déclare pas', () => {
    const snapshot = snapshotForFoodItem(
      buildItem({ nutritionPer100: { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 } }),
      200,
    );

    expect(snapshot.fiberG).toBeUndefined();
    expect('fiberG' in snapshot).toBe(false);
  });

  it('ne dépend pas de l’aliment après coup : le résultat est une valeur figée', () => {
    const item = buildItem();
    const snapshot = snapshotForFoodItem(item, 150);

    item.nutritionPer100.kcal = 999;

    expect(snapshot.kcal).toBe(195);
  });

  it.each([0, -50, Number.NaN])('rejette la quantité %s', (quantityG) => {
    expect(() => snapshotForFoodItem(buildItem(), quantityG)).toThrow(InvalidInputError);
  });
});

describe('snapshotForMeal', () => {
  const rice = buildItem();
  const chicken = buildItem({
    id: 'food-poulet',
    name: 'Blanc de poulet',
    brand: undefined,
    nutritionPer100: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
  });

  const meal: Meal = {
    id: 'meal-1',
    name: 'Riz-poulet',
    items: [
      { foodItemId: rice.id, quantityG: 150 },
      { foodItemId: chicken.id, quantityG: 120 },
    ],
    createdAt: '2026-03-15T08:00:00.000Z',
  };

  const resolve = (id: string) => [rice, chicken].find((item) => item.id === id);

  it('somme les composants', () => {
    expect(snapshotForMeal(meal, resolve)).toEqual({
      name: 'Riz-poulet',
      kcal: 393,
      proteinG: 41.3,
      carbsG: 42,
      fatG: 4.8,
      fiberG: 0.6,
    });
  });

  it('multiplie par le nombre de portions', () => {
    expect(snapshotForMeal(meal, resolve, 2).kcal).toBe(786);
  });

  it('refuse un repas dont un aliment manque plutôt que de sous-compter', () => {
    expect(() => snapshotForMeal(meal, () => undefined)).toThrow(/Aliment introuvable/);
  });

  it('refuse un repas vide', () => {
    expect(() => snapshotForMeal({ ...meal, items: [] }, resolve)).toThrow(
      /ne contient aucun aliment/,
    );
  });

  it('rejette un nombre de portions invalide', () => {
    expect(() => snapshotForMeal(meal, resolve, 0)).toThrow(InvalidInputError);
  });

  it('n’ajoute pas de fibres si aucun composant n’en déclare', () => {
    const snapshot = snapshotForMeal(
      { ...meal, items: [{ foodItemId: chicken.id, quantityG: 120 }] },
      resolve,
    );

    expect('fiberG' in snapshot).toBe(false);
  });
});

describe('totalMealWeightG', () => {
  const meal: Meal = {
    id: 'meal-1',
    name: 'Bol',
    items: [
      { foodItemId: 'a', quantityG: 150 },
      { foodItemId: 'b', quantityG: 120 },
    ],
    createdAt: '2026-03-15T08:00:00.000Z',
  };

  it('additionne les quantités', () => {
    expect(totalMealWeightG(meal)).toBe(270);
    expect(totalMealWeightG(meal, 2)).toBe(540);
  });

  it('rejette un nombre de portions invalide', () => {
    expect(() => totalMealWeightG(meal, -1)).toThrow(InvalidInputError);
  });
});

describe('sumDailyTotals', () => {
  it('renvoie des zéros pour une journée vide', () => {
    expect(sumDailyTotals([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 });
  });

  it('additionne les snapshots', () => {
    const totals = sumDailyTotals([
      buildEntry({ kcal: 195, proteinG: 4.1, carbsG: 42, fatG: 0.5, fiberG: 0.6 }),
      buildEntry({ kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4 }),
    ]);

    expect(totals).toEqual({ kcal: 325, proteinG: 6.8, carbsG: 70, fatG: 0.8, fiberG: 1 });
  });

  it('traite une absence de fibres comme zéro, sans fausser le reste', () => {
    const totals = sumDailyTotals([
      buildEntry({ kcal: 100, fiberG: 2 }),
      buildEntry({ kcal: 100 }),
    ]);

    expect(totals.fiberG).toBe(2);
    expect(totals.kcal).toBe(200);
  });

  it('évite l’accumulation d’erreurs en virgule flottante', () => {
    const totals = sumDailyTotals(
      Array.from({ length: 10 }, () => buildEntry({ proteinG: 0.1, fatG: 0.2 })),
    );

    expect(totals.proteinG).toBe(1);
    expect(totals.fatG).toBe(2);
  });
});
