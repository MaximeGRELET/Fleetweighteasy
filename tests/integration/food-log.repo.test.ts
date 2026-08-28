import { getSyncMeta } from '@/data/db/sync-meta';
import { createFoodLogRepository, type FoodLogRepository } from '@/data/repositories/food-log.repo';
import { createFoodRepository, type FoodRepository } from '@/data/repositories/food.repo';
import { createMealRepository, type MealRepository } from '@/data/repositories/meal.repo';
import { snapshotForFoodItem, snapshotForMeal } from '@/domain/journal/snapshot';

import { buildFoodItem } from './helpers/fixtures';
import { createTestDatabase, type TestDatabase } from './helpers/test-db';

const DATE = '2026-03-15';

describe('foodLogRepo', () => {
  let database: TestDatabase;
  let foodLogRepo: FoodLogRepository;
  let foodRepo: FoodRepository;
  let mealRepo: MealRepository;

  beforeEach(() => {
    database = createTestDatabase();
    foodLogRepo = createFoodLogRepository(database.context);
    foodRepo = createFoodRepository(database.context);
    mealRepo = createMealRepository(database.context);
  });

  afterEach(() => {
    database.close();
  });

  function logRice(quantityG = 150) {
    const item = foodRepo.upsert(buildFoodItem());

    return foodLogRepo.addEntry({
      date: DATE,
      mealType: 'lunch',
      foodItemId: item.id,
      quantityG,
      snapshot: snapshotForFoodItem(item, quantityG),
    });
  }

  describe('cycle de vie d’une entrée', () => {
    it('crée une entrée et la relit à l’identique', () => {
      const created = logRice();

      expect(foodLogRepo.getById(created.id)).toEqual(created);
      expect(created.snapshot).toEqual({
        name: 'Riz basmati cuit (Marque Test)',
        kcal: 195,
        proteinG: 4.1,
        carbsG: 42,
        fatG: 0.5,
        fiberG: 0.6,
      });
    });

    it('liste les entrées du jour dans l’ordre d’ajout', () => {
      const first = logRice(100);
      database.advanceMinutes(90);
      const second = logRice(200);

      expect(foodLogRepo.getByDate(DATE).map((entry) => entry.id)).toEqual([first.id, second.id]);
    });

    it('sépare les jours et les types de repas', () => {
      const item = foodRepo.upsert(buildFoodItem());
      const snapshot = snapshotForFoodItem(item, 100);

      foodLogRepo.addEntry({
        date: DATE,
        mealType: 'breakfast',
        foodItemId: item.id,
        quantityG: 100,
        snapshot,
      });
      foodLogRepo.addEntry({
        date: DATE,
        mealType: 'dinner',
        foodItemId: item.id,
        quantityG: 100,
        snapshot,
      });
      foodLogRepo.addEntry({
        date: '2026-03-16',
        mealType: 'breakfast',
        foodItemId: item.id,
        quantityG: 100,
        snapshot,
      });

      expect(foodLogRepo.getByDate(DATE)).toHaveLength(2);
      expect(foodLogRepo.getByMealType(DATE, 'breakfast')).toHaveLength(1);
      expect(foodLogRepo.getByDateRange('2026-03-15', '2026-03-16')).toHaveLength(3);
      expect(foodLogRepo.getByDateRange('2026-03-17', '2026-03-20')).toEqual([]);
    });

    it('supprime une entrée', () => {
      const created = logRice();

      foodLogRepo.remove(created.id);

      expect(foodLogRepo.getById(created.id)).toBeUndefined();
      expect(foodLogRepo.getByDate(DATE)).toEqual([]);
    });

    it('conserve l’horodatage d’origine lors d’une correction', () => {
      const created = logRice(150);
      const item = foodRepo.getById('food-riz');

      database.advanceMinutes(60);
      const replaced = foodLogRepo.replaceEntry(created.id, {
        date: DATE,
        mealType: 'lunch',
        foodItemId: created.foodItemId ?? '',
        quantityG: 200,
        snapshot: snapshotForFoodItem(item!, 200),
      });

      expect(replaced.loggedAt).toBe(created.loggedAt);
      expect(replaced.snapshot.kcal).toBe(260);
      expect(foodLogRepo.getByDate(DATE)).toHaveLength(1);
    });
  });

  describe('cas limites', () => {
    it('journalise un aliment sans fibres déclarées', () => {
      const item = foodRepo.upsert(
        buildFoodItem({
          id: 'food-sans-fibres',
          barcode: undefined,
          nutritionPer100: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
        }),
      );

      const entry = foodLogRepo.addEntry({
        date: DATE,
        mealType: 'dinner',
        foodItemId: item.id,
        quantityG: 120,
        snapshot: snapshotForFoodItem(item, 120),
      });

      const reloaded = foodLogRepo.getById(entry.id);
      expect(reloaded?.snapshot.fiberG).toBeUndefined();
      expect('fiberG' in (reloaded?.snapshot ?? {})).toBe(false);
      expect(foodLogRepo.getDailyTotals(DATE).fiberG).toBe(0);
    });

    it('recrée une entrée dont l’identifiant n’existe plus', () => {
      const item = foodRepo.upsert(buildFoodItem());

      // Cas de reprise après suppression concurrente : on ne perd pas la saisie.
      const restored = foodLogRepo.replaceEntry('id-inconnu', {
        date: DATE,
        mealType: 'snack',
        foodItemId: item.id,
        quantityG: 50,
        snapshot: snapshotForFoodItem(item, 50),
      });

      expect(restored.id).toBe('id-inconnu');
      expect(restored.loggedAt).toBe(database.currentNow().toISOString());
      expect(foodLogRepo.getById('id-inconnu')).toEqual(restored);
    });
  });

  describe('snapshot nutritionnel — l’historique est immuable', () => {
    it('ne change pas quand l’aliment source est corrigé', () => {
      const created = logRice(150);
      const before = foodLogRepo.getById(created.id);

      // Six mois plus tard, la fiche Open Food Facts est corrigée.
      foodRepo.upsert(
        buildFoodItem({
          nutritionPer100: { kcal: 350, proteinG: 7, carbsG: 78, fatG: 1, fiberG: 1.2 },
          verified: true,
        }),
      );

      expect(foodLogRepo.getById(created.id)).toEqual(before);
      expect(foodLogRepo.getById(created.id)?.snapshot.kcal).toBe(195);
      expect(foodRepo.getById('food-riz')?.nutritionPer100.kcal).toBe(350);
    });

    it('survit à la suppression de l’aliment source', () => {
      const created = logRice(150);

      foodRepo.remove('food-riz');

      const entry = foodLogRepo.getById(created.id);
      expect(entry).toBeDefined();
      expect(entry?.foodItemId).toBeUndefined();
      // Le nom figé permet d'afficher l'entrée sans sa source.
      expect(entry?.snapshot.name).toBe('Riz basmati cuit (Marque Test)');
      expect(entry?.snapshot.kcal).toBe(195);
    });

    it('laisse les totaux du jour inchangés après correction de la source', () => {
      logRice(150);
      const totalsBefore = foodLogRepo.getDailyTotals(DATE);

      foodRepo.upsert(
        buildFoodItem({ nutritionPer100: { kcal: 999, proteinG: 99, carbsG: 99, fatG: 99 } }),
      );

      expect(foodLogRepo.getDailyTotals(DATE)).toEqual(totalsBefore);
    });
  });

  describe('totaux du jour', () => {
    it('somme les snapshots, pas les aliments', () => {
      logRice(150);
      database.advanceMinutes(30);
      logRice(100);

      expect(foodLogRepo.getDailyTotals(DATE)).toEqual({
        kcal: 325,
        proteinG: 6.8,
        carbsG: 70,
        fatG: 0.8,
        fiberG: 1,
      });
    });

    it('renvoie des totaux nuls pour un jour vide', () => {
      expect(foodLogRepo.getDailyTotals('2026-01-01')).toEqual({
        kcal: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fiberG: 0,
      });
    });
  });

  describe('entrées issues d’un repas prédéfini', () => {
    it('journalise un repas complet', () => {
      const rice = foodRepo.upsert(buildFoodItem());
      const chicken = foodRepo.upsert(
        buildFoodItem({
          id: 'food-poulet',
          barcode: undefined,
          name: 'Blanc de poulet',
          brand: undefined,
          nutritionPer100: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
        }),
      );

      const created = mealRepo.create({
        name: 'Riz-poulet',
        items: [
          { foodItemId: rice.id, quantityG: 150 },
          { foodItemId: chicken.id, quantityG: 120 },
        ],
      });

      const snapshot = snapshotForMeal(created, (id) => foodRepo.getById(id));
      const entry = foodLogRepo.addEntry({
        date: DATE,
        mealType: 'dinner',
        mealId: created.id,
        quantityG: 270,
        snapshot,
      });

      expect(entry.snapshot).toEqual({
        name: 'Riz-poulet',
        kcal: 393, // 195 + 198
        proteinG: 41.3, // 4.05 + 37.2
        carbsG: 42,
        fatG: 4.8, // 0.45 + 4.32
        fiberG: 0.6,
      });
      expect(entry.mealId).toBe(created.id);
      expect(entry.foodItemId).toBeUndefined();
    });
  });

  describe('synchronisation', () => {
    it('marque chaque écriture comme à synchroniser', () => {
      const created = logRice();

      expect(getSyncMeta(database.db, 'food_log_entry', created.id)).toMatchObject({
        dirty: true,
        updatedAt: database.currentNow().toISOString(),
      });
    });

    it('conserve une pierre tombale après suppression', () => {
      const created = logRice();
      database.advanceMinutes(10);
      foodLogRepo.remove(created.id);

      const meta = getSyncMeta(database.db, 'food_log_entry', created.id);
      expect(meta?.dirty).toBe(true);
      expect(meta?.deletedAt).toBe(database.currentNow().toISOString());
    });
  });
});
