import { listDirty } from '@/data/db/sync-meta';
import { offItemId } from '@/data/remote/off-mapping';
import { createOpenFoodFactsSource } from '@/data/remote/openfoodfacts';
import { createRateLimiter } from '@/data/remote/throttle';
import { createRepositories, type Repositories } from '@/data/repositories/factory';
import { snapshotForFoodItem } from '@/domain/journal/snapshot';

import { createFakeFetch, type FakeFetch } from './remote/helpers/fake-fetch';
import {
  buildOffProduct,
  buildProductResponse,
  NUTELLA_BARCODE,
} from './remote/helpers/off-fixtures';
import { createTestDatabase, type TestDatabase } from './helpers/test-db';

const USER_AGENT = 'FleetWeightEasy/0.1.0 (contact@example.org)';
const TODAY = '2026-03-15';

/**
 * Chaîne complète : source distante → cache local → journal.
 *
 * Ces tests franchissent volontairement les deux frontières d'un coup, parce
 * que c'est là que vivent les garanties de la phase : le cache est bien la
 * source de vérité, et le snapshot du journal ne dépend plus de personne une
 * fois écrit (PHASES_2_A_5 §4.5 et PHASE_2 §2.4).
 */
describe('cache local et distant', () => {
  let database: TestDatabase;
  let repositories: Repositories;
  let fake: FakeFetch;

  function createSource() {
    return createOpenFoodFactsSource({
      userAgent: USER_AGENT,
      fetchImpl: fake.impl,
      now: () => new Date('2026-03-15T08:00:00.000Z'),
      productLimiter: createRateLimiter({ maxCalls: 100, windowMs: 60_000, maxWaitMs: 100 }),
      searchLimiter: createRateLimiter({ maxCalls: 100, windowMs: 60_000, maxWaitMs: 100 }),
    });
  }

  beforeEach(() => {
    database = createTestDatabase();
    repositories = createRepositories(database.context);
    fake = createFakeFetch();
  });

  afterEach(() => {
    database.close();
  });

  it('met en cache un produit consulté, avec un identifiant déterministe', async () => {
    fake.queueJson(buildProductResponse());

    const item = await createSource().getByBarcode(NUTELLA_BARCODE);
    if (item) {
      repositories.food.upsert(item);
    }

    const cached = repositories.food.getByBarcode(NUTELLA_BARCODE);
    expect(cached?.id).toBe(offItemId(NUTELLA_BARCODE));
    expect(cached?.source).toBe('off');
  });

  it('ne duplique pas la ligne quand le produit est rescanné', async () => {
    // L'identifiant dérive du code-barres : deux scans mettent à jour la même
    // ligne au lieu d'en empiler une seconde.
    fake.queueJson(buildProductResponse());
    fake.queueJson(buildProductResponse(buildOffProduct({ product_name_fr: 'Nom corrigé' })));

    const source = createSource();
    const first = await source.getByBarcode(NUTELLA_BARCODE);
    const second = await source.getByBarcode(NUTELLA_BARCODE);

    if (first) repositories.food.upsert(first);
    if (second) repositories.food.upsert(second);

    expect(repositories.food.count()).toBe(1);
    expect(repositories.food.getByBarcode(NUTELLA_BARCODE)?.name).toBe('Nom corrigé');
  });

  it('rend le produit consultable sans réseau une fois en cache', async () => {
    fake.queueJson(buildProductResponse());

    const item = await createSource().getByBarcode(NUTELLA_BARCODE);
    if (item) {
      repositories.food.upsert(item);
    }

    // Plus aucune réponse en file : toute nouvelle requête échouerait. Le
    // cache, lui, répond toujours.
    const offlineRead = repositories.food.getByBarcode(NUTELLA_BARCODE);
    expect(offlineRead?.name).toBe('Nutella pâte à tartiner');
    expect(repositories.food.searchByName('nutella')).toHaveLength(1);
  });

  it('n’envoie pas le cache Open Food Facts à la synchronisation', async () => {
    // Le cache est reconstructible depuis le réseau : le pousser au serveur
    // gonflerait la synchro sans rien apporter, et brouillerait la frontière
    // ODbL (src/data/remote/licence.ts).
    fake.queueJson(buildProductResponse());
    const item = await createSource().getByBarcode(NUTELLA_BARCODE);
    if (item) {
      repositories.food.upsert(item);
    }

    repositories.food.createCustom({
      name: 'Soupe maison',
      nutritionPer100: { kcal: 80, proteinG: 3, carbsG: 10, fatG: 2 },
    });

    const dirtyFoodIds = listDirty(database.db)
      .filter((record) => record.entityType === 'food_item')
      .map((record) => record.entityId);

    expect(dirtyFoodIds).toHaveLength(1);
    expect(dirtyFoodIds[0]).not.toBe(offItemId(NUTELLA_BARCODE));
  });

  describe('immuabilité du journal', () => {
    it('fige le snapshot : corriger l’aliment ne réécrit pas le passé', async () => {
      fake.queueJson(buildProductResponse());
      const item = await createSource().getByBarcode(NUTELLA_BARCODE);
      if (!item) {
        throw new Error('produit attendu');
      }

      repositories.food.upsert(item);
      const entry = repositories.foodLog.addEntry({
        date: TODAY,
        mealType: 'breakfast',
        foodItemId: item.id,
        quantityG: 30,
        snapshot: snapshotForFoodItem(item, 30),
      });

      // Six mois plus tard, la fiche collaborative est corrigée.
      repositories.food.upsert({
        ...item,
        nutritionPer100: { ...item.nutritionPer100, kcal: 400 },
      });

      expect(repositories.foodLog.getById(entry.id)?.snapshot).toEqual(entry.snapshot);
      expect(repositories.foodLog.getDailyTotals(TODAY).kcal).toBe(entry.snapshot.kcal);
    });

    it('garde l’entrée lisible même si l’aliment est supprimé', async () => {
      fake.queueJson(buildProductResponse());
      const item = await createSource().getByBarcode(NUTELLA_BARCODE);
      if (!item) {
        throw new Error('produit attendu');
      }

      repositories.food.upsert(item);
      const entry = repositories.foodLog.addEntry({
        date: TODAY,
        mealType: 'breakfast',
        foodItemId: item.id,
        quantityG: 30,
        snapshot: snapshotForFoodItem(item, 30),
      });

      repositories.food.remove(item.id);

      const reloaded = repositories.foodLog.getById(entry.id);
      expect(reloaded?.snapshot.name).toBe(entry.snapshot.name);
      expect(reloaded?.foodItemId).toBeUndefined();
    });
  });

  describe('hors ligne', () => {
    it('journalise sans réseau à partir d’un aliment maison', () => {
      const item = repositories.food.createCustom({
        name: 'Soupe maison',
        nutritionPer100: { kcal: 80, proteinG: 3, carbsG: 10, fatG: 2 },
      });

      repositories.foodLog.addEntry({
        date: TODAY,
        mealType: 'dinner',
        foodItemId: item.id,
        quantityG: 300,
        snapshot: snapshotForFoodItem(item, 300),
      });

      expect(repositories.foodLog.getDailyTotals(TODAY).kcal).toBe(240);
      // Aucune requête n'est partie : ce chemin ne connaît pas le réseau.
      expect(fake.requests).toHaveLength(0);
    });

    it('corrige et supprime une entrée sans réseau', () => {
      const item = repositories.food.createCustom({
        name: 'Soupe maison',
        nutritionPer100: { kcal: 80, proteinG: 3, carbsG: 10, fatG: 2 },
      });

      const entry = repositories.foodLog.addEntry({
        date: TODAY,
        mealType: 'dinner',
        foodItemId: item.id,
        quantityG: 300,
        snapshot: snapshotForFoodItem(item, 300),
      });

      repositories.foodLog.replaceEntry(entry.id, {
        date: TODAY,
        mealType: 'dinner',
        foodItemId: item.id,
        quantityG: 150,
        snapshot: snapshotForFoodItem(item, 150),
      });

      expect(repositories.foodLog.getDailyTotals(TODAY).kcal).toBe(120);

      repositories.foodLog.remove(entry.id);
      expect(repositories.foodLog.getByDate(TODAY)).toEqual([]);
      expect(fake.requests).toHaveLength(0);
    });
  });
});
