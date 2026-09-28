import { SYNC_ENTITY_TYPES, syncState, weightEntry } from '@/data/db/schema';
import { getSyncMeta, listDirty, markDirty } from '@/data/db/sync-meta';
import { createRepositories, type Repositories } from '@/data/repositories/factory';
import { createSyncEngine, PUSH_BATCH_SIZE, type SyncEngine } from '@/data/sync';
import { APPLY_ORDER } from '@/data/sync/registry';
import { PRIVACY_POLICY_VERSION } from '@/lib/legal';

import { buildFoodItem, buildStoredProfile } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/test-db';
import { createFakeRemote, type FakeRemote } from './helpers/fake-remote';

/**
 * Moteur de synchronisation (ticket #17), éprouvé sur de vraies bases SQLite
 * migrées : un « appareil » est une base en mémoire avec ses repositories, et
 * plusieurs appareils partagent le même serveur simulé.
 *
 * Ce que PHASES_6_A_10 §9.7 exige : hors ligne → en ligne, conflits, reprise
 * après coupure, aucune perte ni doublon.
 */

interface Device {
  database: TestDatabase;
  repositories: Repositories;
  engine: SyncEngine;
}

const START = new Date('2026-03-15T08:00:00.000Z');
const DAY = '2026-03-15';

describe('moteur de synchronisation', () => {
  let remote: FakeRemote;
  let devices: Device[];

  function createDevice(name: string): Device {
    const database = createTestDatabase({ startAt: START, idPrefix: name });
    const device = {
      database,
      repositories: createRepositories(database.context),
      engine: createSyncEngine({ db: database.db, remote, now: database.context.now }),
    };
    devices.push(device);
    return device;
  }

  beforeEach(() => {
    remote = createFakeRemote();
    devices = [];
  });

  afterEach(() => {
    devices.forEach((device) => device.database.close());
  });

  /** Remplit un appareil comme après quelques jours d'usage réel. */
  function useApp(device: Device) {
    const { repositories } = device;
    repositories.consent.grant(PRIVACY_POLICY_VERSION);
    repositories.profile.save(buildStoredProfile({ targetWeightKg: 65 }));

    // Aliment maison : le cache Open Food Facts n'est pas synchronisé (Phase 4).
    const food = repositories.food.upsert(buildFoodItem({ source: 'custom' }));
    const savedMeal = repositories.meal.create({
      name: 'Bol du midi',
      items: [{ foodItemId: food.id, quantityG: 150 }],
    });
    repositories.foodLog.addEntry({
      date: DAY,
      mealType: 'lunch',
      foodItemId: food.id,
      quantityG: 150,
      snapshot: { name: food.name, kcal: 195, proteinG: 4, carbsG: 42, fatG: 0.5 },
    });
    repositories.foodLog.addEntry({
      date: DAY,
      mealType: 'dinner',
      mealId: savedMeal.id,
      quantityG: 150,
      snapshot: { name: savedMeal.name, kcal: 195, proteinG: 4, carbsG: 42, fatG: 0.5 },
    });
    repositories.weight.upsertForDate({ date: DAY, weightKg: 72.4 });
    repositories.workout.add({
      date: DAY,
      payload: { type: 'cardio', activity: 'running', metEntryId: 'running_8kmh', durationMin: 30 },
      estimatedKcalBurned: 290,
    });
  }

  /** Tout ce qu'un utilisateur peut voir de ses données. */
  function snapshotOf({ repositories }: Device) {
    return {
      consent: repositories.consent.get(),
      profile: repositories.profile.get(),
      goals: repositories.profile.getGoalHistory(),
      foods: repositories.food.count(),
      meals: repositories.meal.listAll(),
      log: repositories.foodLog.getByDate(DAY),
      weights: repositories.weight.getHistory(),
      workouts: repositories.workout.getByDate(DAY),
    };
  }

  describe('envoi', () => {
    it('envoie tout ce qui a été écrit, puis vide la file', async () => {
      const phone = createDevice('phone');
      useApp(phone);
      const pending = listDirty(phone.database.db).length;

      const report = await phone.engine.sync();

      expect(report.pushed).toBe(pending);
      expect(remote.stored()).toHaveLength(pending);
      expect(listDirty(phone.database.db)).toEqual([]);
    });

    it('envoie une suppression sous forme de pierre tombale', async () => {
      const phone = createDevice('phone');
      const entry = phone.repositories.weight.upsertForDate({ date: DAY, weightKg: 72 });
      await phone.engine.sync();

      phone.database.advanceMinutes(5);
      phone.repositories.weight.remove(entry.id);
      await phone.engine.sync();

      expect(remote.get('weight_entry', entry.id)).toMatchObject({
        deletedAt: phone.database.currentNow().toISOString(),
      });
      expect(remote.get('weight_entry', entry.id)?.row).toBeUndefined();
    });

    it('garde en file une entité modifiée pendant l’envoi', async () => {
      const phone = createDevice('phone');
      phone.repositories.profile.save(buildStoredProfile());

      // L'utilisateur modifie son profil pendant que la requête est en vol.
      remote.duringPush = () => {
        phone.database.advanceMinutes(1);
        phone.repositories.profile.save(buildStoredProfile({ currentWeightKg: 71 }));
      };
      await phone.engine.sync();
      remote.duringPush = undefined;

      expect(getSyncMeta(phone.database.db, 'profile', '1')?.dirty).toBe(true);

      await phone.engine.sync();
      expect(remote.get('profile', '1')?.row).toMatchObject({ currentWeightKg: 71 });
    });

    it('envoie par lots, et une coupure ne fait renvoyer que les lots suivants', async () => {
      const phone = createDevice('phone');
      const total = PUSH_BATCH_SIZE + 10;
      for (let index = 0; index < total; index += 1) {
        phone.repositories.food.upsert(buildFoodItem({ id: `food-${index}`, source: 'custom' }));
      }

      remote.failPushNumber = 2;
      await expect(phone.engine.sync()).rejects.toThrow('Coupure');

      // Le premier lot est acquitté, le second attend.
      expect(listDirty(phone.database.db)).toHaveLength(10);

      await phone.engine.sync();
      expect(listDirty(phone.database.db)).toEqual([]);
      expect(remote.stored()).toHaveLength(total);
    });
  });

  describe('hors ligne', () => {
    it('ne perd rien hors ligne et envoie tout au retour du réseau', async () => {
      const phone = createDevice('phone');
      remote.offline = true;
      useApp(phone);

      await expect(phone.engine.sync()).rejects.toThrow('Réseau indisponible');
      const pending = listDirty(phone.database.db).length;
      expect(pending).toBeGreaterThan(0);

      remote.offline = false;
      await phone.engine.sync();

      expect(listDirty(phone.database.db)).toEqual([]);
      expect(remote.stored()).toHaveLength(pending);
    });

    it('reste pleinement utilisable sans jamais synchroniser', () => {
      const phone = createDevice('phone');
      remote.offline = true;

      useApp(phone);

      expect(snapshotOf(phone).weights).toHaveLength(1);
      expect(snapshotOf(phone).log).toHaveLength(2);
    });
  });

  describe('deux appareils', () => {
    it('restitue sur un second appareil exactement ce que le premier a saisi', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      useApp(phone);

      await phone.engine.sync();
      await tablet.engine.sync();

      expect(snapshotOf(tablet)).toEqual(snapshotOf(phone));
    });

    it('ne marque rien à renvoyer sur l’appareil qui reçoit', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      useApp(phone);
      await phone.engine.sync();

      await tablet.engine.sync();

      expect(listDirty(tablet.database.db)).toEqual([]);
    });

    it('propage une suppression', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      const entry = phone.repositories.weight.upsertForDate({ date: DAY, weightKg: 72 });
      await phone.engine.sync();
      await tablet.engine.sync();
      expect(tablet.repositories.weight.getById(entry.id)).toBeDefined();

      phone.database.advanceMinutes(10);
      phone.repositories.weight.remove(entry.id);
      await phone.engine.sync();
      await tablet.engine.sync();

      expect(tablet.repositories.weight.getById(entry.id)).toBeUndefined();
      expect(getSyncMeta(tablet.database.db, 'weight_entry', entry.id)).toMatchObject({
        dirty: false,
        deletedAt: expect.any(String),
      });
    });

    /**
     * Les versions reçues sont écrites telles quelles, sans repasser par
     * `profile.save` : la réception ne doit pas fabriquer de faux changements
     * d'objectif, que la détection de risque lirait comme des révisions.
     */
    it('ne duplique pas l’historique des objectifs en le recevant', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      phone.repositories.profile.save(buildStoredProfile({ targetWeightKg: 65 }));
      phone.database.advanceMinutes(60);
      phone.repositories.profile.save(buildStoredProfile({ targetWeightKg: 62 }));

      await phone.engine.sync();
      await tablet.engine.sync();
      await tablet.engine.sync();
      await phone.engine.sync();

      expect(tablet.repositories.profile.getGoalHistory()).toHaveLength(2);
      expect(phone.repositories.profile.getGoalHistory()).toHaveLength(2);
    });

    it('n’a plus rien à recevoir au cycle suivant', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      useApp(phone);
      await phone.engine.sync();
      await tablet.engine.sync();

      const report = await tablet.engine.sync();

      expect(report).toEqual({ pushed: 0, pulled: 0, applied: 0 });
    });
  });

  describe('conflits', () => {
    it('garde la modification la plus récente, sur les deux appareils', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      phone.repositories.profile.save(buildStoredProfile());
      await phone.engine.sync();
      await tablet.engine.sync();

      // Deux modifications hors ligne ; la tablette écrit en dernier.
      phone.database.advanceMinutes(10);
      phone.repositories.profile.save(buildStoredProfile({ currentWeightKg: 71 }));
      tablet.database.advanceMinutes(20);
      tablet.repositories.profile.save(buildStoredProfile({ currentWeightKg: 70.5 }));

      await tablet.engine.sync();
      await phone.engine.sync();

      expect(phone.repositories.profile.get()?.currentWeightKg).toBe(70.5);
      expect(tablet.repositories.profile.get()?.currentWeightKg).toBe(70.5);
    });

    it('ne laisse pas une version plus ancienne écraser une modification locale', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      phone.repositories.profile.save(buildStoredProfile());
      await phone.engine.sync();
      await tablet.engine.sync();

      tablet.database.advanceMinutes(20);
      tablet.repositories.profile.save(buildStoredProfile({ currentWeightKg: 70.5 }));
      // Le téléphone écrit plus tôt, mais synchronise le premier.
      phone.database.advanceMinutes(10);
      phone.repositories.profile.save(buildStoredProfile({ currentWeightKg: 71 }));

      await phone.engine.sync();
      await tablet.engine.sync();
      await phone.engine.sync();

      expect(tablet.repositories.profile.get()?.currentWeightKg).toBe(70.5);
      expect(phone.repositories.profile.get()?.currentWeightKg).toBe(70.5);
    });

    it('ne ressuscite pas une entité supprimée plus récemment qu’elle n’a été modifiée', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      const entry = phone.repositories.weight.upsertForDate({ date: DAY, weightKg: 72 });
      await phone.engine.sync();
      await tablet.engine.sync();

      phone.database.advanceMinutes(10);
      phone.repositories.weight.upsertForDate({ date: DAY, weightKg: 71.8 });
      tablet.database.advanceMinutes(20);
      tablet.repositories.weight.remove(entry.id);

      await phone.engine.sync();
      await tablet.engine.sync();
      await phone.engine.sync();

      expect(phone.repositories.weight.getById(entry.id)).toBeUndefined();
      expect(tablet.repositories.weight.getById(entry.id)).toBeUndefined();
    });

    it('converge vers une seule pesée quand deux appareils pèsent le même jour', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      phone.repositories.weight.upsertForDate({ date: DAY, weightKg: 72.4 });
      tablet.database.advanceMinutes(30);
      tablet.repositories.weight.upsertForDate({ date: DAY, weightKg: 72.1 });

      await phone.engine.sync();
      await tablet.engine.sync();
      await phone.engine.sync();
      await tablet.engine.sync();

      for (const device of [phone, tablet]) {
        const weights = device.repositories.weight.getHistory();
        expect(weights).toHaveLength(1);
        expect(weights[0]?.weightKg).toBe(72.1);
        expect(listDirty(device.database.db)).toEqual([]);
      }
      const live = remote.stored().filter((change) => change.entityType === 'weight_entry');
      expect(live.filter((change) => change.deletedAt === undefined)).toHaveLength(1);
    });

    it('converge aussi quand la pesée la plus récente est celle déjà présente', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      tablet.repositories.weight.upsertForDate({ date: DAY, weightKg: 72.1 });
      phone.database.advanceMinutes(30);
      phone.repositories.weight.upsertForDate({ date: DAY, weightKg: 72.4 });

      await tablet.engine.sync();
      await phone.engine.sync();
      await tablet.engine.sync();

      expect(phone.repositories.weight.getHistory().map((w) => w.weightKg)).toEqual([72.4]);
      expect(tablet.repositories.weight.getHistory().map((w) => w.weightKg)).toEqual([72.4]);
    });

    /**
     * L'horloge d'un téléphone peut reculer (réglage manuel, fuseau mal
     * configuré). Une suppression datée de cette heure-là serait plus ancienne
     * que la pesée qu'elle écarte, et le serveur la refuserait.
     */
    it('date une suppression après la pesée qu’elle écarte, même si l’horloge a reculé', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      tablet.database.advanceMinutes(30);
      tablet.repositories.weight.upsertForDate({ date: DAY, weightKg: 72.1 });
      const phoneWeighing = phone.repositories.weight.upsertForDate({ date: DAY, weightKg: 72.4 });
      await phone.engine.sync();

      tablet.database.setNow(new Date(START.getTime() - 60 * 60_000));
      await tablet.engine.sync();

      expect(remote.get('weight_entry', phoneWeighing.id)?.deletedAt).toBeDefined();
    });
  });

  describe('reprise après coupure', () => {
    it('n’applique rien d’une réception interrompue, puis reprend sans doublon', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      useApp(phone);
      await phone.engine.sync();

      remote.pageSize = 2;
      remote.failPullPageNumber = 2;
      await expect(tablet.engine.sync()).rejects.toThrow('Coupure');

      expect(tablet.repositories.profile.get()).toBeUndefined();
      expect(tablet.database.db.select().from(syncState).all()).toEqual([]);

      await tablet.engine.sync();
      expect(snapshotOf(tablet)).toEqual(snapshotOf(phone));
    });

    it('recolle une entrée du journal à son aliment arrivé sur une autre page', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      useApp(phone);
      await phone.engine.sync();

      remote.pageSize = 1;
      await tablet.engine.sync();

      const lunch = tablet.repositories.foodLog.getByMealType(DAY, 'lunch')[0];
      expect(lunch?.foodItemId).toBe('food-riz');
    });

    it('détache une entrée dont l’aliment n’existe plus nulle part, sans bloquer le reste', async () => {
      const tablet = createDevice('tablet');
      remote.seed({
        entityType: 'food_log_entry',
        entityId: 'orphan',
        updatedAt: START.toISOString(),
        row: {
          id: 'orphan',
          date: DAY,
          mealType: 'lunch',
          foodItemId: 'food-disparu',
          mealId: null,
          quantityG: 100,
          nameSnapshot: 'Pomme',
          kcalSnapshot: 52,
          proteinGSnapshot: 0.3,
          carbsGSnapshot: 14,
          fatGSnapshot: 0.2,
          fiberGSnapshot: null,
          loggedAt: START.toISOString(),
        },
      });

      await tablet.engine.sync();

      const entry = tablet.repositories.foodLog.getById('orphan');
      expect(entry?.snapshot.name).toBe('Pomme');
      expect(entry?.foodItemId).toBeUndefined();
    });
  });

  describe('cache Open Food Facts', () => {
    /**
     * Décision de la Phase 4 : le cache OFF se reconstruit depuis le réseau, il
     * n'est pas synchronisé. Une entrée du journal qui en vient arrive donc sur
     * l'autre appareil détachée de son produit — mais complète, grâce au
     * snapshot nutritionnel.
     */
    it('n’envoie pas les produits Open Food Facts consultés', async () => {
      const phone = createDevice('phone');
      phone.repositories.food.upsert(buildFoodItem({ id: 'off:3017620422003', source: 'off' }));

      await phone.engine.sync();

      expect(remote.stored()).toEqual([]);
    });

    it('restitue une entrée tirée d’Open Food Facts avec son snapshot, sans son produit', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      const product = phone.repositories.food.upsert(
        buildFoodItem({ id: 'off:3017620422003', source: 'off' }),
      );
      const entry = phone.repositories.foodLog.addEntry({
        date: DAY,
        mealType: 'lunch',
        foodItemId: product.id,
        quantityG: 150,
        snapshot: { name: product.name, kcal: 195, proteinG: 4, carbsG: 42, fatG: 0.5 },
      });

      await phone.engine.sync();
      await tablet.engine.sync();

      const received = tablet.repositories.foodLog.getById(entry.id);
      expect(received?.snapshot).toEqual(entry.snapshot);
      expect(received?.foodItemId).toBeUndefined();
    });
  });

  describe('cas limites', () => {
    it('décrit comme supprimée une entité marquée modifiée mais absente de sa table', async () => {
      const phone = createDevice('phone');
      markDirty(phone.database.db, 'meal', 'fantome', phone.database.currentNow());

      await phone.engine.sync();

      expect(remote.get('meal', 'fantome')).toMatchObject({
        deletedAt: phone.database.currentNow().toISOString(),
      });
    });

    /**
     * Deux appareils qui écrivent à la même milliseconde : le serveur ne
     * retient que la première version reçue et refuse l'autre. L'appareil
     * perdant doit s'y ranger, sinon les deux divergent pour toujours.
     */
    it('se range à la version du serveur à horodatage égal', async () => {
      const phone = createDevice('phone');
      const tablet = createDevice('tablet');
      phone.repositories.profile.save(buildStoredProfile({ currentWeightKg: 71 }));
      tablet.repositories.profile.save(buildStoredProfile({ currentWeightKg: 70.5 }));

      await phone.engine.sync();
      await tablet.engine.sync();

      expect(tablet.repositories.profile.get()?.currentWeightKg).toBe(71);
      expect(listDirty(tablet.database.db)).toEqual([]);
    });

    it('supprime une entité reçue sans contenu, même sans date de suppression explicite', async () => {
      const tablet = createDevice('tablet');
      const entry = tablet.repositories.weight.upsertForDate({ date: DAY, weightKg: 72 });
      await tablet.engine.sync();
      const later = new Date(START.getTime() + 60_000).toISOString();

      remote.seed({ entityType: 'weight_entry', entityId: entry.id, updatedAt: later });
      await tablet.engine.sync();

      expect(tablet.repositories.weight.getById(entry.id)).toBeUndefined();
      expect(getSyncMeta(tablet.database.db, 'weight_entry', entry.id)?.deletedAt).toBe(later);
    });

    it('écarte une pesée locale sans trace de synchro au profit de la pesée reçue', async () => {
      const tablet = createDevice('tablet');
      tablet.database.db.insert(weightEntry).values({ id: 'local', date: DAY, weightKg: 70 }).run();
      remote.seed({
        entityType: 'weight_entry',
        entityId: 'recue',
        updatedAt: START.toISOString(),
        row: { id: 'recue', date: DAY, weightKg: 71.5, note: null },
      });

      await tablet.engine.sync();

      expect(tablet.repositories.weight.getHistory().map((w) => w.id)).toEqual(['recue']);
    });

    it('détache une entrée dont le repas n’existe plus nulle part', async () => {
      const tablet = createDevice('tablet');
      remote.seed({
        entityType: 'food_log_entry',
        entityId: 'orphan-meal',
        updatedAt: START.toISOString(),
        row: {
          id: 'orphan-meal',
          date: DAY,
          mealType: 'dinner',
          foodItemId: null,
          mealId: 'meal-disparu',
          quantityG: 300,
          nameSnapshot: 'Bol du soir',
          kcalSnapshot: 420,
          proteinGSnapshot: 20,
          carbsGSnapshot: 50,
          fatGSnapshot: 12,
          fiberGSnapshot: null,
          loggedAt: START.toISOString(),
        },
      });

      await tablet.engine.sync();

      expect(tablet.repositories.foodLog.getById('orphan-meal')?.mealId).toBeUndefined();
    });
  });

  it('ne lance qu’un cycle à la fois', async () => {
    const phone = createDevice('phone');
    phone.repositories.profile.save(buildStoredProfile());

    const [first, second] = await Promise.all([phone.engine.sync(), phone.engine.sync()]);

    expect(second).toBe(first);
    expect(remote.pushCalls).toBe(1);
  });

  it('prend l’identité d’une version reçue dans son en-tête, jamais dans son contenu', async () => {
    const tablet = createDevice('tablet');
    remote.seed({
      entityType: 'weight_entry',
      entityId: 'w-annonce',
      updatedAt: START.toISOString(),
      row: { id: 'w-autre', date: DAY, weightKg: 70, note: null },
    });

    await tablet.engine.sync();

    expect(tablet.repositories.weight.getById('w-annonce')?.weightKg).toBe(70);
    expect(tablet.repositories.weight.getById('w-autre')).toBeUndefined();
  });
});

describe('registre des entités synchronisées', () => {
  it('ordonne chaque type synchronisé, une fois et une seule', () => {
    expect([...APPLY_ORDER].sort()).toEqual([...SYNC_ENTITY_TYPES].sort());
  });

  it('applique les aliments et repas avant les entrées qui les référencent', () => {
    const position = (type: (typeof APPLY_ORDER)[number]) => APPLY_ORDER.indexOf(type);

    expect(position('food_item')).toBeLessThan(position('food_log_entry'));
    expect(position('meal')).toBeLessThan(position('food_log_entry'));
  });
});
