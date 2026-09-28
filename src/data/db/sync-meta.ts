import { and, eq } from 'drizzle-orm';

import { type SyncEntityType, syncMeta } from './schema';
import type { AppDatabase } from './types';

/**
 * Journal de synchronisation.
 *
 * Posé dès la Phase 2. L'app reste locale (Phase 9), et le moteur de
 * `src/data/sync/` n'est branché nulle part ; mais reconstruire après coup
 * l'état « modifié localement » d'une base déjà remplie serait bien plus
 * coûteux que de le tenir à jour depuis le début.
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
 * pourrait jamais être propagée si une synchro voit le jour. Elle serait
 * purgée une fois la suppression confirmée par le serveur.
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

/** Accuse réception d'une synchronisation réussie. */
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

/**
 * Accuse réception d'un envoi, **seulement si** l'entité n'a pas bougé depuis.
 *
 * Une écriture survenue pendant l'aller-retour réseau a avancé `updatedAt` :
 * la marquer synchronisée ferait disparaître de la file une modification que
 * le serveur n'a jamais reçue. Renvoie vrai si l'accusé a été enregistré.
 */
export function markSyncedIfUnchanged(
  db: AppDatabase,
  entityType: SyncEntityType,
  entityId: string,
  pushedUpdatedAt: string,
  at: Date,
): boolean {
  // Lecture puis écriture sans risque d'entrelacement : l'accès SQLite est
  // synchrone, aucune autre écriture ne peut s'intercaler entre les deux.
  if (getSyncMeta(db, entityType, entityId)?.updatedAt !== pushedUpdatedAt) {
    return false;
  }

  markSynced(db, entityType, entityId, at);
  return true;
}

/**
 * Enregistre une version reçue du serveur : l'entité locale en est désormais
 * le reflet exact, rien n'est à renvoyer.
 *
 * `updatedAt` reprend l'horodatage **d'origine** de la version, et non l'heure
 * de réception : c'est lui qui départage les conflits suivants.
 */
export function recordRemoteVersion(
  db: AppDatabase,
  version: { entityType: SyncEntityType; entityId: string; updatedAt: string; deletedAt?: string },
  at: Date,
): void {
  const values = {
    updatedAt: version.updatedAt,
    syncedAt: at.toISOString(),
    dirty: false,
    deletedAt: version.deletedAt ?? null,
  };

  db.insert(syncMeta)
    .values({ entityType: version.entityType, entityId: version.entityId, ...values })
    .onConflictDoUpdate({ target: [syncMeta.entityType, syncMeta.entityId], set: values })
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
