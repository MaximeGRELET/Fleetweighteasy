import { and, eq } from 'drizzle-orm';

import { type SyncEntityType, syncMeta } from './schema';
import type { AppDatabase } from './types';

/**
 * Journal de synchronisation.
 *
 * Posé dès la Phase 2 alors que la synchro serveur n'arrive qu'en Phase 9 :
 * reconstruire après coup l'état « modifié localement » d'une base déjà remplie
 * est bien plus coûteux que de le tenir à jour depuis le début.
 *
 * Toute écriture d'un repository passe par `markDirty` ou `markDeleted`, dans
 * la **même transaction** que l'écriture métier — sinon un crash entre les deux
 * laisserait une donnée modifiée mais jamais synchronisée.
 */

export interface SyncMetaRecord {
  entityType: SyncEntityType;
  entityId: string;
  updatedAt: string;
  syncedAt?: string;
  dirty: boolean;
  deletedAt?: string;
}

/** Marque une entité comme créée ou modifiée localement. */
export function markDirty(
  db: AppDatabase,
  entityType: SyncEntityType,
  entityId: string,
  at: Date,
): void {
  const updatedAt = at.toISOString();

  db.insert(syncMeta)
    .values({ entityType, entityId, updatedAt, syncedAt: null, dirty: true, deletedAt: null })
    .onConflictDoUpdate({
      target: [syncMeta.entityType, syncMeta.entityId],
      // Une entité recréée après suppression redevient une entité vivante.
      set: { updatedAt, dirty: true, deletedAt: null },
    })
    .run();
}

/**
 * Marque une entité comme supprimée localement.
 *
 * La ligne est **conservée** : sans cette pierre tombale, la suppression ne
 * pourrait jamais être propagée au serveur (Phase 9). Elle sera purgée une fois
 * la suppression confirmée par le serveur.
 */
export function markDeleted(
  db: AppDatabase,
  entityType: SyncEntityType,
  entityId: string,
  at: Date,
): void {
  const timestamp = at.toISOString();

  db.insert(syncMeta)
    .values({
      entityType,
      entityId,
      updatedAt: timestamp,
      syncedAt: null,
      dirty: true,
      deletedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [syncMeta.entityType, syncMeta.entityId],
      set: { updatedAt: timestamp, dirty: true, deletedAt: timestamp },
    })
    .run();
}

/** Entités en attente de synchronisation. */
export function listDirty(db: AppDatabase): SyncMetaRecord[] {
  return db.select().from(syncMeta).where(eq(syncMeta.dirty, true)).all().map(toRecord);
}

export function getSyncMeta(
  db: AppDatabase,
  entityType: SyncEntityType,
  entityId: string,
): SyncMetaRecord | undefined {
  const row = db
    .select()
    .from(syncMeta)
    .where(and(eq(syncMeta.entityType, entityType), eq(syncMeta.entityId, entityId)))
    .get();

  return row ? toRecord(row) : undefined;
}

/** Accuse réception d'une synchronisation réussie (utilisé en Phase 9). */
export function markSynced(
  db: AppDatabase,
  entityType: SyncEntityType,
  entityId: string,
  at: Date,
): void {
  db.update(syncMeta)
    .set({ dirty: false, syncedAt: at.toISOString() })
    .where(and(eq(syncMeta.entityType, entityType), eq(syncMeta.entityId, entityId)))
    .run();
}

type SyncMetaRow = typeof syncMeta.$inferSelect;

function toRecord(row: SyncMetaRow): SyncMetaRecord {
  return {
    entityType: row.entityType,
    entityId: row.entityId,
    updatedAt: row.updatedAt,
    dirty: row.dirty,
    ...(row.syncedAt === null ? {} : { syncedAt: row.syncedAt }),
    ...(row.deletedAt === null ? {} : { deletedAt: row.deletedAt }),
  };
}
