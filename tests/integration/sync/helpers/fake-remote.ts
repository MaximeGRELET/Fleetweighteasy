import type { EntityChange, PullPage, SyncRemote } from '@/data/sync';

/**
 * Serveur de synchronisation en mémoire.
 *
 * Reproduit le contrat attendu du vrai serveur (ticket #18) : une version n'en
 * remplace une autre que si elle est **strictement** plus récente, et chaque
 * version acceptée reçoit un numéro d'ordre croissant, qui sert de curseur.
 *
 * Les versions sont copiées à l'entrée comme à la sortie : un appareil ne
 * partage jamais d'objet avec le serveur, exactement comme à travers le réseau.
 */
export interface FakeRemote extends SyncRemote {
  /** Hors ligne : tout appel échoue. */
  offline: boolean;
  /** Nombre de versions par page de lecture. */
  pageSize: number;
  /** Fait échouer le n-ième envoi à venir (1 = le prochain). */
  failPushNumber?: number;
  /** Fait échouer la n-ième page de lecture à venir (1 = la prochaine). */
  failPullPageNumber?: number;
  /** Exécuté pendant un envoi, avant sa réponse : simule une écriture concurrente. */
  duringPush?: () => void;
  pushCalls: number;
  /** Dernière version connue de chaque entité. */
  stored: () => EntityChange[];
  get: (entityType: EntityChange['entityType'], entityId: string) => EntityChange | undefined;
  /** Dépose une version directement, comme si un autre appareil l'avait envoyée. */
  seed: (change: EntityChange) => void;
}

interface StoredVersion {
  change: EntityChange;
  seq: number;
}

export function createFakeRemote(options: { pageSize?: number } = {}): FakeRemote {
  const versions = new Map<string, StoredVersion>();
  let seq = 0;

  const keyOf = (change: { entityType: string; entityId: string }) =>
    `${change.entityType}:${change.entityId}`;
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

  function accept(change: EntityChange): void {
    const existing = versions.get(keyOf(change));
    if (existing && existing.change.updatedAt >= change.updatedAt) {
      return;
    }
    seq += 1;
    versions.set(keyOf(change), { change: copy(change), seq });
  }

  function offlineError(): Error {
    return new Error('Réseau indisponible');
  }

  const remote: FakeRemote = {
    offline: false,
    pageSize: options.pageSize ?? 50,
    pushCalls: 0,

    push(changes) {
      remote.pushCalls += 1;

      if (remote.offline) {
        return Promise.reject(offlineError());
      }
      if (remote.failPushNumber !== undefined) {
        remote.failPushNumber -= 1;
        if (remote.failPushNumber === 0) {
          remote.failPushNumber = undefined;
          return Promise.reject(new Error('Coupure pendant l’envoi'));
        }
      }

      remote.duringPush?.();
      changes.forEach(accept);
      return Promise.resolve();
    },

    pull(cursor): Promise<PullPage> {
      if (remote.offline) {
        return Promise.reject(offlineError());
      }
      if (remote.failPullPageNumber !== undefined) {
        remote.failPullPageNumber -= 1;
        if (remote.failPullPageNumber === 0) {
          remote.failPullPageNumber = undefined;
          return Promise.reject(new Error('Coupure pendant la réception'));
        }
      }

      const after = cursor === undefined ? 0 : Number(cursor);
      const pending = [...versions.values()]
        .filter((version) => version.seq > after)
        .sort((a, b) => a.seq - b.seq);
      const page = pending.slice(0, remote.pageSize);
      const last = page[page.length - 1];

      return Promise.resolve({
        changes: page.map((version) => copy(version.change)),
        cursor: last ? String(last.seq) : String(after),
        hasMore: pending.length > page.length,
      });
    },

    stored: () => [...versions.values()].map((version) => copy(version.change)),
    get: (entityType, entityId) => {
      const version = versions.get(keyOf({ entityType, entityId }));
      return version ? copy(version.change) : undefined;
    },
    seed: accept,
  };

  return remote;
}
