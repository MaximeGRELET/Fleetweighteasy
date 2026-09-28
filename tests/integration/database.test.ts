import { createTestDatabase, listTableNames, type TestDatabase } from './helpers/test-db';

/**
 * Vérifie que les migrations générées par drizzle-kit appliquent proprement le
 * schéma sur une base vierge — la même vérification que fera l'app au démarrage.
 */
describe('migrations', () => {
  let database: TestDatabase;

  beforeEach(() => {
    database = createTestDatabase();
  });

  afterEach(() => {
    database.close();
  });

  it('migre une base vierge sans erreur', () => {
    expect(listTableNames(database)).toEqual(
      expect.arrayContaining([
        'consent',
        'food_item',
        'food_log_entry',
        'goal_change_event',
        'meal',
        'profile',
        'sync_meta',
        'sync_state',
        'weight_entry',
        'workout_log_entry',
      ]),
    );
  });

  it('est idempotente : rejouer les migrations ne casse rien', () => {
    const second = createTestDatabase();
    expect(listTableNames(second)).toEqual(listTableNames(database));
    second.close();
  });
});
