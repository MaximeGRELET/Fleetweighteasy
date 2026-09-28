import { and, eq, ne } from 'drizzle-orm';

import { foodItem, meal, syncState, weightEntry } from '@/data/db/schema';
import {
  getSyncMeta,
  listDirty,
  markDeleted,
  markSyncedIfUnchanged,
  recordRemoteVersion,
  type SyncMetaRecord,
} from '@/data/db/sync-meta';
import type { AppDatabase } from '@/data/db/types';

import { APPLY_ORDER, SYNCED_TABLES } from './registry';
import type { EntityChange, SyncRemote, SyncReport } from './types';

/**
 * Moteur de synchronisation local ↔ serveur.
 *
 * Le local reste la source de vérité pour l'usage ; le serveur est la
 * sauvegarde et le point de rencontre des appareils (PHASES_6_A_10 §9.5). Un
 * cycle se fait en deux temps :
 *
 * 1. **Envoi** des entités marquées `dirty` dans `sync_meta`, pierres tombales
 *    comprises, par lots. Chaque lot accepté est acquitté aussitôt : une
 *    coupure au milieu ne fait renvoyer que les lots suivants.
 * 2. **Réception** de tout ce que le serveur a enregistré depuis le dernier
 *    curseur, appliqué **en une seule transaction** avec le nouveau curseur.
 *    Une coupure pendant la réception n'applique rien et ne déplace pas le
 *    curseur : le cycle suivant reprend au même point.
 *
 * Résolution des conflits (AVANCEMENT.md, « Décisions — Phase 9 ») :
 * - par défaut, **la dernière écriture gagne**, ligne par ligne, sur
 *   l'horodatage d'origine de chaque version ;
 * - une **pesée par date** : deux appareils qui pèsent le même jour gardent la
 *   plus récente, et l'autre est supprimée partout ;
 * - l'historique des objectifs n'est jamais modifié, seulement complété : il ne
 *   peut pas entrer en conflit.
 */
export interface SyncEngine {
  /**
   * Lance un cycle complet. Un appel pendant un cycle en cours ne démarre rien :
   * il reçoit le résultat du cycle en cours.
   */
  sync(): Promise<SyncReport>;
}

export interface SyncEngineOptions {
  db: AppDatabase;
  remote: SyncRemote;
  now: () => Date;
}

/**
 * Taille d'un lot d'envoi. Assez grand pour qu'une première synchro ne se
 * compte pas en centaines d'allers-retours, assez petit pour qu'une coupure ne
 * fasse pas tout renvoyer.
 */
export const PUSH_BATCH_SIZE = 200;

const SYNC_STATE_ROW_ID = 1;

export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const { db, remote, now } = options;
  let running: Promise<SyncReport> | undefined;

  async function runCycle(): Promise<SyncReport> {
    let pushed = await pushDirty();
    const { pulled, applied } = await pullAndApply();

    // La résolution d'un conflit peut produire des suppressions à propager
    // (une pesée par date). Les envoyer tout de suite évite qu'un appareil
    // reste divergent jusqu'à la prochaine synchro, qui peut tarder.
    if (listDirty(db).length > 0) {
      pushed += await pushDirty();
    }

    return { pushed, pulled, applied };
  }

  async function pushDirty(): Promise<number> {
    const outgoing = listDirty(db).map((meta) => toOutgoingChange(db, meta));
    let acknowledged = 0;

    for (let start = 0; start < outgoing.length; start += PUSH_BATCH_SIZE) {
      const batch = outgoing.slice(start, start + PUSH_BATCH_SIZE);
      await remote.push(batch);

      const at = now();
      db.transaction((tx) => {
        for (const change of batch) {
          markSyncedIfUnchanged(tx, change.entityType, change.entityId, change.updatedAt, at);
        }
      });
      acknowledged += batch.length;
    }

    return acknowledged;
  }

  async function pullAndApply(): Promise<{ pulled: number; applied: number }> {
    let cursor = readCursor(db);
    const received: EntityChange[] = [];

    // Tout est rassemblé avant d'écrire : une entrée du journal et l'aliment
    // qu'elle référence peuvent arriver sur deux pages différentes.
    for (;;) {
      const page = await remote.pull(cursor);
      received.push(...page.changes);
      cursor = page.cursor;
      if (!page.hasMore) {
        break;
      }
    }

    const at = now();
    let applied = 0;

    db.transaction((tx) => {
      for (const change of sortForApply(received)) {
        if (applyRemoteChange(tx, change, at)) {
          applied += 1;
        }
      }
      writeCursor(tx, cursor);
    });

    return { pulled: received.length, applied };
  }

  return {
    sync() {
      running ??= runCycle().finally(() => {
        running = undefined;
      });
      return running;
    },
  };
}

// --- Envoi -----------------------------------------------------------------

function toOutgoingChange(db: AppDatabase, meta: SyncMetaRecord): EntityChange {
  const base = { entityType: meta.entityType, entityId: meta.entityId, updatedAt: meta.updatedAt };

  if (meta.deletedAt !== undefined) {
    return { ...base, deletedAt: meta.deletedAt };
  }

  const row = readRow(db, meta);

  // Une entité marquée modifiée mais absente de sa table n'existe plus : la
  // décrire comme supprimée est l'état le plus fidèle qu'on puisse envoyer.
  return row ? { ...base, row } : { ...base, deletedAt: meta.updatedAt };
}

function readRow(
  db: AppDatabase,
  meta: { entityType: SyncMetaRecord['entityType']; entityId: string },
): Record<string, unknown> | undefined {
  const { table, idColumn, toKey } = SYNCED_TABLES[meta.entityType];
  return db
    .select()
    .from(table)
    .where(eq(idColumn, toKey(meta.entityId)))
    .get();
}

// --- Réception -------------------------------------------------------------

/** Tri stable par type : à type égal, l'ordre d'arrivée du serveur est conservé. */
function sortForApply(changes: EntityChange[]): EntityChange[] {
  return changes
    .map((change, index) => ({ change, index }))
    .sort(
      (a, b) =>
        APPLY_ORDER.indexOf(a.change.entityType) - APPLY_ORDER.indexOf(b.change.entityType) ||
        a.index - b.index,
    )
    .map(({ change }) => change);
}

/**
 * La version locale l'emporte-t-elle sur celle reçue ?
 *
 * Seulement si elle est strictement plus récente. À horodatage égal, c'est la
 * version du serveur qui reste : il refuse lui-même toute version qui n'est pas
 * strictement plus récente que la sienne, donc la locale ne passerait jamais.
 * S'y ranger est la seule façon pour deux appareils ayant écrit à la même
 * milliseconde de converger.
 */
function localWins(local: SyncMetaRecord, change: EntityChange): boolean {
  return local.updatedAt > change.updatedAt;
}

/** Applique une version reçue. Renvoie vrai si la base locale a changé. */
function applyRemoteChange(tx: AppDatabase, change: EntityChange, at: Date): boolean {
  const local = getSyncMeta(tx, change.entityType, change.entityId);

  if (local && localWins(local, change)) {
    return false;
  }

  const { table, idColumn, toKey } = SYNCED_TABLES[change.entityType];
  const key = toKey(change.entityId);

  if (change.deletedAt !== undefined || change.row === undefined) {
    tx.delete(table).where(eq(idColumn, key)).run();
    recordRemoteVersion(tx, { ...change, deletedAt: change.deletedAt ?? change.updatedAt }, at);
    return true;
  }

  // La clé vient de l'identité de la version, jamais du contenu : une ligne
  // mal formée ne peut pas écraser une autre entité que celle annoncée.
  const row = { ...change.row, id: key };

  if (change.entityType === 'weight_entry' && !resolveSameDayWeighing(tx, change, row, at)) {
    return false;
  }

  if (change.entityType === 'food_log_entry') {
    detachMissingSources(tx, row);
  }

  tx.insert(table)
    .values(row as typeof table.$inferInsert)
    .onConflictDoUpdate({ target: idColumn, set: row as typeof table.$inferInsert })
    .run();
  recordRemoteVersion(tx, change, at);
  return true;
}

/**
 * Une pesée par date : si l'appareil en a déjà une autre le même jour, la plus
 * récente reste, l'autre est supprimée — et la suppression est envoyée au
 * serveur, pour que tous les appareils convergent vers la même pesée.
 *
 * Renvoie vrai si la version reçue doit être appliquée.
 */
function resolveSameDayWeighing(
  tx: AppDatabase,
  change: EntityChange,
  row: Record<string, unknown>,
  at: Date,
): boolean {
  // Une pesée sans date échouera à l'insertion, sur la contrainte NOT NULL :
  // bruyamment, ce qui est voulu. Rien à décider ici en attendant.
  const date = String(row.date);

  const sameDay = tx
    .select({ id: weightEntry.id })
    .from(weightEntry)
    .where(and(eq(weightEntry.date, date), ne(weightEntry.id, change.entityId)))
    .get();

  if (!sameDay) {
    return true;
  }

  const localUpdatedAt = getSyncMeta(tx, 'weight_entry', sameDay.id)?.updatedAt ?? '';

  if (localUpdatedAt > change.updatedAt) {
    // La pesée locale est la plus récente : la version reçue disparaît partout.
    markDeleted(tx, 'weight_entry', change.entityId, tombstoneTime(at, change.updatedAt));
    return false;
  }

  tx.delete(weightEntry).where(eq(weightEntry.id, sameDay.id)).run();
  markDeleted(tx, 'weight_entry', sameDay.id, tombstoneTime(at, localUpdatedAt));
  return true;
}

/**
 * Horodatage d'une suppression décidée par la synchro.
 *
 * Il doit être **strictement** postérieur à la version supprimée, sinon le
 * serveur la refuserait et la pesée écartée survivrait ailleurs. L'heure de
 * l'appareil n'y suffit pas toujours : elle peut retarder sur celle de
 * l'appareil qui a écrit la version.
 */
function tombstoneTime(at: Date, deletedVersionUpdatedAt: string): Date {
  const justAfter = Date.parse(deletedVersionUpdatedAt) + 1;
  return Number.isNaN(justAfter) || at.getTime() >= justAfter ? at : new Date(justAfter);
}

/**
 * Détache une entrée du journal d'une source absente localement.
 *
 * Même règle qu'une suppression locale (`ON DELETE SET NULL`) : le snapshot
 * nutritionnel suffit à afficher l'entrée, qui ne doit pas bloquer le reste de
 * la synchro parce que son aliment n'existe plus nulle part.
 */
function detachMissingSources(tx: AppDatabase, row: Record<string, unknown>): void {
  if (
    typeof row.foodItemId === 'string' &&
    !tx.select({ id: foodItem.id }).from(foodItem).where(eq(foodItem.id, row.foodItemId)).get()
  ) {
    row.foodItemId = null;
  }

  if (
    typeof row.mealId === 'string' &&
    !tx.select({ id: meal.id }).from(meal).where(eq(meal.id, row.mealId)).get()
  ) {
    row.mealId = null;
  }
}

// --- Curseur ---------------------------------------------------------------

function readCursor(db: AppDatabase): string | undefined {
  const row = db.select().from(syncState).where(eq(syncState.id, SYNC_STATE_ROW_ID)).get();
  return row?.pullCursor ?? undefined;
}

function writeCursor(db: AppDatabase, cursor: string | undefined): void {
  const values = { id: SYNC_STATE_ROW_ID, pullCursor: cursor ?? null };

  db.insert(syncState)
    .values(values)
    .onConflictDoUpdate({ target: syncState.id, set: { pullCursor: values.pullCursor } })
    .run();
}
