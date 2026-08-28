import { getSyncMeta, listDirty } from '@/data/db/sync-meta';
import { createFoodRepository, type FoodRepository } from '@/data/repositories/food.repo';
import { createMealRepository, type MealRepository } from '@/data/repositories/meal.repo';

import { buildFoodItem } from './helpers/fixtures';
import { createTestDatabase, type TestDatabase } from './helpers/test-db';

describe('foodRepo', () => {
  let database: TestDatabase;
  let foodRepo: FoodRepository;

  beforeEach(() => {
    database = createTestDatabase();
    foodRepo = createFoodRepository(database.context);
  });

  afterEach(() => {
    database.close();
  });

  describe('cache Open Food Facts', () => {
    it('met en cache un produit et le relit à l’identique', () => {
      const item = buildFoodItem();

      foodRepo.upsert(item);

      expect(foodRepo.getById(item.id)).toEqual(item);
      expect(foodRepo.getByBarcode('3017620422003')).toEqual(item);
    });

    it('remplace un produit déjà en cache', () => {
      foodRepo.upsert(buildFoodItem());
      foodRepo.upsert(buildFoodItem({ name: 'Riz basmati (corrigé)', verified: true }));

      expect(foodRepo.count()).toBe(1);
      expect(foodRepo.getById('food-riz')?.name).toBe('Riz basmati (corrigé)');
    });

    it('conserve les champs nutritionnels optionnels absents comme absents', () => {
      foodRepo.upsert(
        buildFoodItem({
          id: 'food-nu',
          barcode: undefined,
          brand: undefined,
          nutritionPer100: { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 },
        }),
      );

      const reloaded = foodRepo.getById('food-nu');
      expect(reloaded?.nutritionPer100).toEqual({ kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 });
      expect(reloaded?.barcode).toBeUndefined();
      expect(reloaded?.brand).toBeUndefined();
    });

    it('conserve tous les champs nutritionnels optionnels renseignés', () => {
      const item = buildFoodItem({
        id: 'food-complet',
        nutritionPer100: {
          kcal: 250,
          proteinG: 8,
          carbsG: 45,
          fatG: 4,
          fiberG: 3.2,
          sugarG: 12,
          saturatedFatG: 1.1,
          sodiumMg: 380,
        },
      });

      foodRepo.upsert(item);

      expect(foodRepo.getById('food-complet')?.nutritionPer100).toEqual(item.nutritionPer100);
    });

    it('renvoie undefined pour un code-barres inconnu', () => {
      foodRepo.upsert(buildFoodItem());

      expect(foodRepo.getByBarcode('0000000000000')).toBeUndefined();
      expect(foodRepo.getById('inexistant')).toBeUndefined();
    });

    it('ne synchronise pas le cache distant : ce sont des données reconstructibles', () => {
      foodRepo.upsert(buildFoodItem());

      expect(getSyncMeta(database.db, 'food_item', 'food-riz')).toBeUndefined();
      expect(listDirty(database.db)).toEqual([]);
    });
  });

  describe('aliments maison', () => {
    it('crée un aliment maison avec un identifiant généré', () => {
      const created = foodRepo.createCustom({
        name: 'Ma sauce tomate',
        nutritionPer100: { kcal: 60, proteinG: 1.5, carbsG: 8, fatG: 2.5 },
      });

      expect(created.id).toBe('id-1');
      expect(created.source).toBe('custom');
      expect(created.verified).toBe(true);
      expect(created.servingSizes).toEqual([]);
      expect(created.cachedAt).toBe(database.currentNow().toISOString());
      expect(foodRepo.getById('id-1')).toEqual(created);
    });

    it('conserve code-barres, marque et portions quand ils sont fournis', () => {
      const created = foodRepo.createCustom({
        name: 'Pain de la boulangerie',
        brand: 'Boulangerie du coin',
        barcode: '9990000000001',
        nutritionPer100: { kcal: 265, proteinG: 9, carbsG: 49, fatG: 3.2 },
        servingSizes: [{ label: '1 tranche', grams: 30 }],
      });

      expect(created.barcode).toBe('9990000000001');
      expect(created.brand).toBe('Boulangerie du coin');
      expect(created.servingSizes).toEqual([{ label: '1 tranche', grams: 30 }]);
      expect(foodRepo.getByBarcode('9990000000001')).toEqual(created);
    });

    it('synchronise les aliments maison : ce sont des données utilisateur', () => {
      const created = foodRepo.createCustom({
        name: 'Ma sauce tomate',
        nutritionPer100: { kcal: 60, proteinG: 1.5, carbsG: 8, fatG: 2.5 },
      });

      expect(getSyncMeta(database.db, 'food_item', created.id)).toMatchObject({ dirty: true });
    });

    it('ne liste que les aliments maison', () => {
      foodRepo.upsert(buildFoodItem());
      foodRepo.createCustom({
        name: 'Ma sauce tomate',
        nutritionPer100: { kcal: 60, proteinG: 1.5, carbsG: 8, fatG: 2.5 },
      });

      expect(foodRepo.listCustom().map((item) => item.name)).toEqual(['Ma sauce tomate']);
      expect(foodRepo.count()).toBe(2);
    });

    it('laisse une pierre tombale en supprimant un aliment maison', () => {
      const created = foodRepo.createCustom({
        name: 'À supprimer',
        nutritionPer100: { kcal: 10, proteinG: 0, carbsG: 2, fatG: 0 },
      });
      database.advanceMinutes(3);

      foodRepo.remove(created.id);

      expect(foodRepo.getById(created.id)).toBeUndefined();
      expect(getSyncMeta(database.db, 'food_item', created.id)?.deletedAt).toBe(
        database.currentNow().toISOString(),
      );
    });

    it('supprime un produit en cache sans rien inscrire dans la synchro', () => {
      foodRepo.upsert(buildFoodItem());

      foodRepo.remove('food-riz');

      expect(foodRepo.getById('food-riz')).toBeUndefined();
      expect(listDirty(database.db)).toEqual([]);
    });

    it('ignore la suppression d’un identifiant inconnu', () => {
      expect(() => foodRepo.remove('inexistant')).not.toThrow();
      expect(listDirty(database.db)).toEqual([]);
    });
  });

  describe('recherche locale', () => {
    beforeEach(() => {
      foodRepo.upsert(buildFoodItem({ id: 'a', barcode: 'a', name: 'Riz basmati cuit' }));
      foodRepo.upsert(buildFoodItem({ id: 'b', barcode: 'b', name: 'Riz complet cru' }));
      foodRepo.upsert(buildFoodItem({ id: 'c', barcode: 'c', name: 'Pâtes complètes' }));
    });

    it('trouve par fragment de nom, sans tenir compte de la casse', () => {
      expect(foodRepo.searchByName('riz').map((item) => item.id)).toEqual(['a', 'b']);
      expect(foodRepo.searchByName('RIZ')).toHaveLength(2);
    });

    it('trie par nom', () => {
      expect(foodRepo.searchByName('c').map((item) => item.name)).toEqual([
        'Pâtes complètes',
        'Riz basmati cuit',
        'Riz complet cru',
      ]);
    });

    it('respecte la limite demandée', () => {
      expect(foodRepo.searchByName('riz', 1)).toHaveLength(1);
    });

    it('ne renvoie rien pour une requête vide', () => {
      expect(foodRepo.searchByName('   ')).toEqual([]);
    });

    it('traite les jokers SQL comme du texte ordinaire', () => {
      // Sans échappement, « % » ramènerait tout le catalogue.
      expect(foodRepo.searchByName('%')).toEqual([]);
    });
  });
});

describe('mealRepo', () => {
  let database: TestDatabase;
  let mealRepo: MealRepository;

  beforeEach(() => {
    database = createTestDatabase();
    mealRepo = createMealRepository(database.context);
  });

  afterEach(() => {
    database.close();
  });

  it('crée, relit et liste les repas prédéfinis', () => {
    const created = mealRepo.create({
      name: 'Petit-déj protéiné',
      items: [{ foodItemId: 'food-riz', quantityG: 150 }],
    });

    expect(created.id).toBe('id-1');
    expect(created.createdAt).toBe(database.currentNow().toISOString());
    expect(mealRepo.getById(created.id)).toEqual(created);
    expect(mealRepo.listAll()).toEqual([created]);
  });

  it('met à jour la composition d’un repas', () => {
    const created = mealRepo.create({ name: 'Bol', items: [] });

    const updated = mealRepo.update({
      ...created,
      items: [{ foodItemId: 'food-riz', quantityG: 200 }],
    });

    expect(mealRepo.getById(created.id)).toEqual(updated);
    expect(mealRepo.listAll()).toHaveLength(1);
  });

  it('supprime un repas et laisse une pierre tombale', () => {
    const created = mealRepo.create({ name: 'Bol', items: [] });
    database.advanceMinutes(2);

    mealRepo.remove(created.id);

    expect(mealRepo.getById(created.id)).toBeUndefined();
    expect(getSyncMeta(database.db, 'meal', created.id)?.deletedAt).toBe(
      database.currentNow().toISOString(),
    );
  });

  it('trie la liste par nom', () => {
    mealRepo.create({ name: 'Zébu', items: [] });
    mealRepo.create({ name: 'Avocat', items: [] });

    expect(mealRepo.listAll().map((entity) => entity.name)).toEqual(['Avocat', 'Zébu']);
  });
});
