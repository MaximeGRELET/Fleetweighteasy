import {
  BACKED_UP_TABLE_NAMES,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type Backup,
  BackupError,
  type BackupErrorReason,
  createBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  summarizeBackup,
} from '@/data/backup';
import { getSyncMeta, listDirty } from '@/data/db/sync-meta';
import { createRepositories, type Repositories } from '@/data/repositories/factory';
import { PRIVACY_POLICY_VERSION } from '@/lib/legal';

import { buildFoodItem, buildStoredProfile } from './helpers/fixtures';
import {
  countRowsByTable,
  createTestDatabase,
  listAppTableNames,
  type TestDatabase,
} from './helpers/test-db';

/**
 * Sauvegarde par fichier (ticket #21). Sans serveur, ce fichier est la seule
 * copie des données hors du téléphone : un aller-retour doit être exact, et un
 * fichier refusé ne doit rien toucher.
 */

/** Tables propres à l'appareil, volontairement absentes de la sauvegarde. */
const DEVICE_TABLES = ['sync_meta', 'sync_state'];

const DAY = '2026-03-15';

function fillLikeRealUse(repositories: Repositories): void {
  repositories.consent.grant(PRIVACY_POLICY_VERSION);
  repositories.profile.save(buildStoredProfile({ targetWeightKg: 65, allergies: ['arachide'] }));

  const food = repositories.food.upsert(buildFoodItem());
  const custom = repositories.food.createCustom({
    name: 'Granola maison',
    nutritionPer100: { kcal: 450, proteinG: 12, carbsG: 60, fatG: 18 },
  });
  const savedMeal = repositories.meal.create({
    name: 'Bol du midi',
    items: [
      { foodItemId: food.id, quantityG: 150 },
      { foodItemId: custom.id, quantityG: 40 },
    ],
  });
  repositories.foodLog.addEntry({
    date: DAY,
    mealType: 'lunch',
    foodItemId: food.id,
    quantityG: 150,
    snapshot: { name: food.name, kcal: 195, proteinG: 4, carbsG: 42, fatG: 0.5, fiberG: 0.6 },
  });
  repositories.foodLog.addEntry({
    date: DAY,
    mealType: 'dinner',
    mealId: savedMeal.id,
    quantityG: 190,
    snapshot: { name: savedMeal.name, kcal: 375, proteinG: 9, carbsG: 66, fatG: 7.7 },
  });
  repositories.weight.upsertForDate({ date: DAY, weightKg: 72.4, note: 'après le sport' });
  repositories.workout.add({
    date: DAY,
    payload: { type: 'cardio', activity: 'running', metEntryId: 'running_8kmh', durationMin: 30 },
    estimatedKcalBurned: 290,
  });
  repositories.workout.add({
    date: DAY,
    payload: {
      type: 'strength',
      exercises: [
        { exerciseId: 'squat', name: 'Squat', sets: [{ reps: 10, weightKg: 40 }, { reps: 8 }] },
      ],
    },
  });
}

/** Tout ce qu'un utilisateur peut voir de ses données. */
function snapshotOf(repositories: Repositories) {
  return {
    consent: repositories.consent.get(),
    profile: repositories.profile.get(),
    goals: repositories.profile.getGoalHistory(),
    foods: repositories.food.searchByName('a'),
    custom: repositories.food.listCustom(),
    meals: repositories.meal.listAll(),
    log: repositories.foodLog.getByDate(DAY),
    weights: repositories.weight.getHistory(),
    workouts: repositories.workout.getByDate(DAY),
  };
}

function appDataCounts(database: TestDatabase): Record<string, number> {
  const counts = countRowsByTable(database);
  DEVICE_TABLES.forEach((table) => delete counts[table]);
  return counts;
}

function expectRefusal(action: () => unknown, reason: BackupErrorReason): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(BackupError);
  expect((caught as BackupError).reason).toBe(reason);
}

describe('sauvegarde par fichier', () => {
  let source: TestDatabase;
  let target: TestDatabase;

  beforeEach(() => {
    source = createTestDatabase({ idPrefix: 'source' });
    target = createTestDatabase({ idPrefix: 'target' });
  });

  afterEach(() => {
    source.close();
    target.close();
  });

  function exportedText(): string {
    fillLikeRealUse(createRepositories(source.context));
    return serializeBackup(createBackup(source.db, source.currentNow()));
  }

  describe('export', () => {
    /**
     * Recensé depuis `sqlite_master` : une table ajoutée par une future
     * migration fait échouer ce test tant qu'elle n'est ni sauvegardée, ni
     * explicitement classée comme propre à l'appareil.
     */
    it('couvre chaque table applicative, sauf celles propres à l’appareil', () => {
      const expected = listAppTableNames(source).filter((name) => !DEVICE_TABLES.includes(name));

      expect([...BACKED_UP_TABLE_NAMES].sort()).toEqual(expected.sort());
    });

    it('porte sa signature, sa version et sa date', () => {
      const backup = createBackup(source.db, source.currentNow());

      expect(backup).toMatchObject({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: source.currentNow().toISOString(),
      });
    });

    it('exporte chaque ligne de chaque table', () => {
      const backup = parseBackup(exportedText());

      const exported = Object.fromEntries(
        BACKED_UP_TABLE_NAMES.map((name) => [name, backup.tables[name].length]),
      );
      expect(exported).toEqual(appDataCounts(source));
    });

    it('reste lisible par un humain', () => {
      const text = exportedText();

      expect(text).toContain('\n  "tables": {');
      expect(text).toContain('"currentWeightKg": 72.5');
    });
  });

  describe('aller-retour', () => {
    it('restitue exactement les données sur un autre téléphone', () => {
      const text = exportedText();

      restoreBackup(target.db, parseBackup(text), target.currentNow());

      expect(snapshotOf(createRepositories(target.context))).toEqual(
        snapshotOf(createRepositories(source.context)),
      );
      expect(appDataCounts(target)).toEqual(appDataCounts(source));
    });

    it('remplace les données présentes, sans les fusionner', () => {
      const text = exportedText();
      const targetRepositories = createRepositories(target.context);
      targetRepositories.weight.upsertForDate({ date: '2026-01-02', weightKg: 80 });
      targetRepositories.profile.save(buildStoredProfile({ currentWeightKg: 80 }));

      restoreBackup(target.db, parseBackup(text), target.currentNow());

      expect(targetRepositories.weight.getByDate('2026-01-02')).toBeUndefined();
      expect(targetRepositories.profile.get()?.currentWeightKg).toBe(72.5);
    });

    it('garde `sync_meta` fidèle aux données restaurées', () => {
      restoreBackup(target.db, parseBackup(exportedText()), target.currentNow());

      const total = Object.values(appDataCounts(target)).reduce((sum, count) => sum + count, 0);
      expect(listDirty(target.db)).toHaveLength(total);
      expect(getSyncMeta(target.db, 'profile', '1')?.dirty).toBe(true);
    });

    it('résume le contenu avant de restaurer', () => {
      const summary = summarizeBackup(parseBackup(exportedText()));

      expect(summary).toMatchObject({
        exportedAt: source.currentNow().toISOString(),
        profile: 1,
        weight_entry: 1,
        food_log_entry: 2,
        workout_log_entry: 2,
      });
    });
  });

  describe('refus', () => {
    function validBackup(): Backup {
      return parseBackup(exportedText());
    }

    function withRow(table: keyof Backup['tables'], patch: Record<string, unknown>): string {
      const backup = validBackup();
      backup.tables[table] = backup.tables[table].map((row, index) =>
        index === 0 ? { ...row, ...patch } : row,
      );
      return serializeBackup(backup);
    }

    it('refuse un fichier qui n’est pas du JSON', () => {
      expectRefusal(() => parseBackup('{"format": "fleetweighteasy-bac'), 'unreadable');
    });

    it.each([
      ['un autre JSON', '{"name": "liste de courses"}'],
      ['une liste', '[]'],
      ['null', 'null'],
    ])('refuse %s', (_label, text) => {
      expectRefusal(() => parseBackup(text), 'not_a_backup');
    });

    it('refuse une version qu’il ne connaît pas', () => {
      const backup = { ...validBackup(), version: BACKUP_VERSION + 1 };

      expectRefusal(() => parseBackup(JSON.stringify(backup)), 'unsupported_version');
    });

    it.each([
      ['un en-tête sans date', (backup: Backup) => ({ ...backup, exportedAt: undefined })],
      ['des tables absentes', (backup: Backup) => ({ ...backup, tables: undefined })],
      [
        'une table qui n’est pas une liste',
        (backup: Backup) => ({ ...backup, tables: { ...backup.tables, meal: {} } }),
      ],
      [
        'une ligne qui n’est pas un objet',
        (backup: Backup) => ({ ...backup, tables: { ...backup.tables, meal: ['Bol du midi'] } }),
      ],
    ])('refuse %s', (_label, corrupt) => {
      expectRefusal(() => parseBackup(JSON.stringify(corrupt(validBackup()))), 'invalid_content');
    });

    it('refuse une table inconnue', () => {
      const backup = { ...validBackup(), tables: { ...validBackup().tables, recette: [] } };

      expectRefusal(() => parseBackup(JSON.stringify(backup)), 'invalid_content');
    });

    it.each([
      ['une colonne inconnue', 'weight_entry', { bodyFatPercent: 22 }],
      ['un nombre écrit en texte', 'weight_entry', { weightKg: '72,4' }],
      ['un nombre non fini', 'food_log_entry', { kcalSnapshot: null, quantityG: 'Infinity' }],
      ['une valeur hors énumération', 'profile', { goalType: 'bulk' }],
      ['une colonne obligatoire manquante', 'food_log_entry', { nameSnapshot: null }],
      ['un booléen écrit en nombre', 'profile', { onboardingCompleted: 1 }],
      ['une colonne JSON corrompue', 'profile', { allergies: 'arachide' }],
      ['un contenu de séance mal formé', 'workout_log_entry', { payload: '{"type":"yoga"}' }],
    ] as const)('refuse %s', (_label, table, patch) => {
      expectRefusal(() => parseBackup(withRow(table, patch)), 'invalid_content');
    });

    it('tolère une table absente, comme une table vide', () => {
      const backup = validBackup();
      const { workout_log_entry: _dropped, ...tables } = backup.tables;

      expect(parseBackup(JSON.stringify({ ...backup, tables })).tables.workout_log_entry).toEqual(
        [],
      );
    });

    /**
     * Le contrôle des types ne voit pas tout : deux pesées le même jour sont
     * chacune valides. C'est la base qui les refuse — et la transaction qui
     * garantit qu'alors, rien n'a bougé.
     */
    it('ne touche à rien si la base refuse une ligne', () => {
      const backup = validBackup();
      const [weighing] = backup.tables.weight_entry;
      backup.tables.weight_entry.push({ ...weighing, id: 'doublon' });

      const targetRepositories = createRepositories(target.context);
      targetRepositories.profile.save(buildStoredProfile({ currentWeightKg: 80 }));
      const before = countRowsByTable(target);

      expectRefusal(() => restoreBackup(target.db, backup, target.currentNow()), 'invalid_content');

      expect(countRowsByTable(target)).toEqual(before);
      expect(targetRepositories.profile.get()?.currentWeightKg).toBe(80);
    });
  });

  describe('par la fabrique de repositories', () => {
    it('horodate l’export avec l’horloge injectée et restaure sans SQL dans l’UI', () => {
      const sourceRepositories = createRepositories(source.context);
      fillLikeRealUse(sourceRepositories);
      source.advanceMinutes(90);

      const backup = sourceRepositories.maintenance.createBackup();
      createRepositories(target.context).maintenance.restoreBackup(backup);

      expect(backup.exportedAt).toBe(source.currentNow().toISOString());
      expect(createRepositories(target.context).profile.get()).toEqual(
        sourceRepositories.profile.get(),
      );
    });
  });
});
