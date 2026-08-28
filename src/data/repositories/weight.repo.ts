import { asc, between, desc, eq } from 'drizzle-orm';

import { weightEntry } from '@/data/db/schema';
import { markDeleted, markDirty } from '@/data/db/sync-meta';
import { toWeightEntry, toWeightEntryInsert } from '@/data/types';
import type { NewWeightEntry, WeightEntry } from '@/domain/progress/types';

import type { RepositoryContext } from './context';

/**
 * Suivi du poids.
 *
 * Une pesée par jour : la courbe lissée de la Phase 5 raisonne par date, et
 * repeser deux fois dans la journée doit corriger la valeur du jour, pas
 * empiler des points contradictoires.
 */
export interface WeightRepository {
  getById(id: string): WeightEntry | undefined;
  getByDate(date: string): WeightEntry | undefined;
  /** Enregistre la pesée du jour, en remplaçant celle déjà saisie s'il y en a une. */
  upsertForDate(input: NewWeightEntry): WeightEntry;
  /** Historique par date croissante, éventuellement borné. */
  getHistory(range?: { fromDate: string; toDate: string }): WeightEntry[];
  getLatest(): WeightEntry | undefined;
  remove(id: string): void;
}

export function createWeightRepository(context: RepositoryContext): WeightRepository {
  const { db, generateId, now } = context;

  return {
    getById(id) {
      const row = db.select().from(weightEntry).where(eq(weightEntry.id, id)).get();
      return row ? toWeightEntry(row) : undefined;
    },

    getByDate(date) {
      const row = db.select().from(weightEntry).where(eq(weightEntry.date, date)).get();
      return row ? toWeightEntry(row) : undefined;
    },

    upsertForDate(input) {
      const at = now();
      const existing = db.select().from(weightEntry).where(eq(weightEntry.date, input.date)).get();

      // Une correction du jour réutilise l'identifiant existant : côté synchro,
      // c'est une mise à jour, pas une suppression suivie d'une création.
      const entry: WeightEntry = { ...input, id: existing?.id ?? generateId() };
      const values = toWeightEntryInsert(entry);

      db.transaction((tx) => {
        tx.insert(weightEntry)
          .values(values)
          .onConflictDoUpdate({ target: weightEntry.date, set: values })
          .run();

        markDirty(tx, 'weight_entry', entry.id, at);
      });

      return entry;
    },

    getHistory(range) {
      const query = db.select().from(weightEntry);
      const rows = range
        ? query
            .where(between(weightEntry.date, range.fromDate, range.toDate))
            .orderBy(asc(weightEntry.date))
            .all()
        : query.orderBy(asc(weightEntry.date)).all();

      return rows.map(toWeightEntry);
    },

    getLatest() {
      const row = db.select().from(weightEntry).orderBy(desc(weightEntry.date)).limit(1).get();
      return row ? toWeightEntry(row) : undefined;
    },

    remove(id) {
      const at = now();

      db.transaction((tx) => {
        tx.delete(weightEntry).where(eq(weightEntry.id, id)).run();
        markDeleted(tx, 'weight_entry', id, at);
      });
    },
  };
}
