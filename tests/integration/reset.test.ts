import { syncState } from '@/data/db/schema';
import { listDirty } from '@/data/db/sync-meta';
import { createRepositories, type Repositories } from '@/data/repositories/factory';
import { resetAllLocalData } from '@/data/reset';
import { PRIVACY_POLICY_VERSION } from '@/lib/legal';

import { buildFoodItem, buildStoredProfile } from './helpers/fixtures';
import {
  countRows,
  countRowsByTable,
  createTestDatabase,
  DRIZZLE_MIGRATIONS_TABLE,
  listAppTableNames,
  listTableNames,
  type TestDatabase,
} from './helpers/test-db';

/**
 * Remplit **toutes** les tables applicatives, en passant par les repositories :
 * c'est ce qui garantit que `sync_meta` est peuplée elle aussi, comme elle le
 * serait après un usage réel de l'app.
 */
function seedEverything(repositories: Repositories, database: TestDatabase): void {
  repositories.consent.grant(PRIVACY_POLICY_VERSION);
  repositories.profile.save(buildStoredProfile());

  const food = repositories.food.upsert(buildFoodItem());
  const mealEntity = repositories.meal.create({
    name: 'Bol du midi',
    items: [{ foodItemId: food.id, quantityG: 150 }],
  });

  repositories.foodLog.addEntry({
    date: '2026-03-15',
    mealType: 'lunch',
    foodItemId: food.id,
    quantityG: 150,
    snapshot: { name: food.name, kcal: 195, proteinG: 4, carbsG: 42, fatG: 0.5 },
  });
  repositories.foodLog.addEntry({
    date: '2026-03-15',
    mealType: 'dinner',
    mealId: mealEntity.id,
    quantityG: 150,
    snapshot: { name: mealEntity.name, kcal: 195, proteinG: 4, carbsG: 42, fatG: 0.5 },
  });

  repositories.weight.upsertForDate({ date: '2026-03-15', weightKg: 72.4 });

  repositories.workout.add({
    date: '2026-03-15',
    payload: {
      type: 'cardio',
      activity: 'running',
      metEntryId: 'running_8kmh',
      durationMin: 30,
    },
    estimatedKcalBurned: 290,
  });

  // Curseur de réception, comme après une première synchronisation.
  database.db.insert(syncState).values({ id: 1, pullCursor: '42' }).run();
}

describe('resetAllLocalData', () => {
  let database: TestDatabase;
  let repositories: Repositories;

  beforeEach(() => {
    database = createTestDatabase();
    repositories = createRepositories(database.context);
  });

  afterEach(() => {
    database.close();
  });

  it('part d’une base réellement remplie : aucune table applicative n’est vide', () => {
    seedEverything(repositories, database);

    const empty = Object.entries(countRowsByTable(database))
      .filter(([, total]) => total === 0)
      .map(([table]) => table);

    expect(empty).toEqual([]);
  });

  it('vide toutes les tables applicatives, sans en oublier une', () => {
    seedEverything(repositories, database);

    resetAllLocalData(database.db);

    // Le recensement vient de `sqlite_master` : une table ajoutée par une
    // future migration mais oubliée dans `RESETTABLE_TABLES` fait échouer ici.
    expect(countRowsByTable(database)).toEqual({
      consent: 0,
      food_item: 0,
      food_log_entry: 0,
      goal_change_event: 0,
      meal: 0,
      profile: 0,
      sync_meta: 0,
      sync_state: 0,
      weight_entry: 0,
      workout_log_entry: 0,
    });
  });

  it('conserve le schéma : les tables existent toujours, seul leur contenu a disparu', () => {
    seedEverything(repositories, database);
    const before = listTableNames(database);

    resetAllLocalData(database.db);

    expect(listTableNames(database)).toEqual(before);
  });

  it('ne touche pas au journal des migrations, sinon l’app ne rouvrirait plus', () => {
    seedEverything(repositories, database);

    resetAllLocalData(database.db);

    expect(countRows(database, DRIZZLE_MIGRATIONS_TABLE)).toBeGreaterThan(0);
    expect(listAppTableNames(database)).not.toContain(DRIZZLE_MIGRATIONS_TABLE);
  });

  it('remet l’app dans l’état d’un premier lancement', () => {
    seedEverything(repositories, database);

    resetAllLocalData(database.db);

    expect(repositories.profile.get()).toBeUndefined();
    expect(repositories.profile.hasCompletedOnboarding()).toBe(false);
    expect(repositories.consent.get()).toBeUndefined();
    expect(repositories.consent.hasGranted(PRIVACY_POLICY_VERSION)).toBe(false);
    expect(repositories.foodLog.getByDate('2026-03-15')).toEqual([]);
    expect(repositories.foodLog.getDailyTotals('2026-03-15')).toEqual({
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
    });
    expect(repositories.weight.getLatest()).toBeUndefined();
    expect(repositories.weight.getHistory()).toEqual([]);
    expect(repositories.workout.getByDate('2026-03-15')).toEqual([]);
    expect(repositories.meal.listAll()).toEqual([]);
    expect(repositories.food.count()).toBe(0);
  });

  it('ne laisse aucune pierre tombale : rien à synchroniser après un effacement', () => {
    seedEverything(repositories, database);
    expect(listDirty(database.db).length).toBeGreaterThan(0);

    resetAllLocalData(database.db);

    // Contrairement à `profile.clear()`, qui doit propager la suppression au
    // serveur, une réinitialisation simule une installation neuve : il n'y a
    // rien à propager parce qu'il n'y a jamais rien eu.
    expect(listDirty(database.db)).toEqual([]);
  });

  it('laisse une base utilisable : on peut tout resaisir derrière', () => {
    seedEverything(repositories, database);
    resetAllLocalData(database.db);

    repositories.consent.grant(PRIVACY_POLICY_VERSION);
    const stored = repositories.profile.save(buildStoredProfile({ currentWeightKg: 68 }));

    expect(stored.currentWeightKg).toBe(68);
    expect(repositories.profile.get()?.currentWeightKg).toBe(68);
    expect(repositories.profile.hasCompletedOnboarding()).toBe(true);
    expect(repositories.consent.hasGranted(PRIVACY_POLICY_VERSION)).toBe(true);
  });

  it('est idempotente : réinitialiser une base déjà vide ne casse rien', () => {
    resetAllLocalData(database.db);
    resetAllLocalData(database.db);

    const remaining = Object.entries(countRowsByTable(database)).filter(([, total]) => total > 0);

    expect(remaining).toEqual([]);
  });

  it('s’atteint aussi par la fabrique de repositories, sans SQL dans l’UI', () => {
    seedEverything(repositories, database);

    repositories.maintenance.resetAllLocalData();

    expect(repositories.profile.hasCompletedOnboarding()).toBe(false);
    expect(countRowsByTable(database).sync_meta).toBe(0);
  });
});
