import {
  getSyncMeta,
  listDirty,
  markDeleted,
  markDirty,
  markSynced,
  markSyncedIfUnchanged,
  recordRemoteVersion,
} from '@/data/db/sync-meta';
import { createWeightRepository } from '@/data/repositories/weight.repo';

import { createTestDatabase, type TestDatabase } from './helpers/test-db';

/**
 * Le journal de synchronisation est posé en Phase 2 alors que la synchro
 * n'arrive qu'en Phase 9. Ces tests verrouillent son contrat dès maintenant.
 */
describe('journal de synchronisation', () => {
  let database: TestDatabase;

  beforeEach(() => {
    database = createTestDatabase();
  });

  afterEach(() => {
    database.close();
  });

  it('n’a rien à synchroniser sur une base vierge', () => {
    expect(listDirty(database.db)).toEqual([]);
    expect(getSyncMeta(database.db, 'weight_entry', 'inconnu')).toBeUndefined();
  });

  it('enregistre une création comme à synchroniser', () => {
    markDirty(database.db, 'weight_entry', 'w1', database.currentNow());

    expect(getSyncMeta(database.db, 'weight_entry', 'w1')).toEqual({
      entityType: 'weight_entry',
      entityId: 'w1',
      updatedAt: database.currentNow().toISOString(),
      dirty: true,
    });
  });

  it('écrase l’horodatage à chaque modification, sans dupliquer la ligne', () => {
    markDirty(database.db, 'weight_entry', 'w1', database.currentNow());
    database.advanceMinutes(30);
    markDirty(database.db, 'weight_entry', 'w1', database.currentNow());

    expect(listDirty(database.db)).toHaveLength(1);
    expect(getSyncMeta(database.db, 'weight_entry', 'w1')?.updatedAt).toBe(
      database.currentNow().toISOString(),
    );
  });

  it('sépare les entités par type', () => {
    markDirty(database.db, 'weight_entry', 'same-id', database.currentNow());
    markDirty(database.db, 'food_log_entry', 'same-id', database.currentNow());

    expect(listDirty(database.db)).toHaveLength(2);
  });

  it('conserve une pierre tombale pour propager la suppression', () => {
    markDirty(database.db, 'meal', 'm1', database.currentNow());
    database.advanceMinutes(10);
    markDeleted(database.db, 'meal', 'm1', database.currentNow());

    const meta = getSyncMeta(database.db, 'meal', 'm1');
    expect(meta?.deletedAt).toBe(database.currentNow().toISOString());
    expect(meta?.dirty).toBe(true);
    // Sans cette ligne, le serveur ne saurait jamais que l'entité a disparu.
    expect(listDirty(database.db)).toHaveLength(1);
  });

  it('fait revivre une entité recréée après suppression', () => {
    markDeleted(database.db, 'meal', 'm1', database.currentNow());
    database.advanceMinutes(5);
    markDirty(database.db, 'meal', 'm1', database.currentNow());

    expect(getSyncMeta(database.db, 'meal', 'm1')?.deletedAt).toBeUndefined();
  });

  it('sort de la file une fois la synchronisation confirmée', () => {
    markDirty(database.db, 'profile', '1', database.currentNow());
    database.advanceMinutes(2);

    markSynced(database.db, 'profile', '1', database.currentNow());

    expect(listDirty(database.db)).toEqual([]);
    expect(getSyncMeta(database.db, 'profile', '1')).toMatchObject({
      dirty: false,
      syncedAt: database.currentNow().toISOString(),
    });
  });

  it('remet en file une entité modifiée après synchronisation', () => {
    markDirty(database.db, 'profile', '1', database.currentNow());
    markSynced(database.db, 'profile', '1', database.currentNow());
    database.advanceMinutes(15);

    markDirty(database.db, 'profile', '1', database.currentNow());

    expect(listDirty(database.db)).toHaveLength(1);
  });

  it('acquitte un envoi quand l’entité n’a pas bougé depuis', () => {
    markDirty(database.db, 'profile', '1', database.currentNow());
    const pushed = database.currentNow().toISOString();

    expect(markSyncedIfUnchanged(database.db, 'profile', '1', pushed, database.currentNow())).toBe(
      true,
    );
    expect(listDirty(database.db)).toEqual([]);
  });

  it('n’acquitte pas un envoi dépassé par une modification survenue entre-temps', () => {
    markDirty(database.db, 'profile', '1', database.currentNow());
    const pushed = database.currentNow().toISOString();
    database.advanceMinutes(1);
    markDirty(database.db, 'profile', '1', database.currentNow());

    expect(markSyncedIfUnchanged(database.db, 'profile', '1', pushed, database.currentNow())).toBe(
      false,
    );
    expect(listDirty(database.db)).toHaveLength(1);
  });

  it('enregistre une version reçue avec son horodatage d’origine, sans rien à renvoyer', () => {
    markDirty(database.db, 'meal', 'm1', database.currentNow());
    database.advanceMinutes(30);

    recordRemoteVersion(
      database.db,
      { entityType: 'meal', entityId: 'm1', updatedAt: '2026-03-15T08:10:00.000Z' },
      database.currentNow(),
    );

    expect(getSyncMeta(database.db, 'meal', 'm1')).toEqual({
      entityType: 'meal',
      entityId: 'm1',
      updatedAt: '2026-03-15T08:10:00.000Z',
      syncedAt: database.currentNow().toISOString(),
      dirty: false,
    });
  });

  it('inscrit l’écriture métier et sa trace de synchro dans la même transaction', () => {
    const weightRepo = createWeightRepository(database.context);
    const entry = weightRepo.upsertForDate({ date: '2026-03-15', weightKg: 72 });

    // Si l'une des deux écritures manquait, la donnée serait modifiée sans
    // jamais être poussée au serveur.
    expect(weightRepo.getById(entry.id)).toBeDefined();
    expect(getSyncMeta(database.db, 'weight_entry', entry.id)?.dirty).toBe(true);
  });
});
