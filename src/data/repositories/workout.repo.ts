import { asc, between, eq } from 'drizzle-orm';

import { workoutLogEntry } from '@/data/db/schema';
import { markDeleted, markDirty } from '@/data/db/sync-meta';
import { toWorkoutLogEntry, toWorkoutLogEntryInsert } from '@/data/types';
import type { NewWorkoutLogEntry, WorkoutLogEntry } from '@/domain/training/types';

import type { RepositoryContext } from './context';

/** Journal des séances (cardio et musculation). */
export interface WorkoutRepository {
  getById(id: string): WorkoutLogEntry | undefined;
  getByDate(date: string): WorkoutLogEntry[];
  getByDateRange(fromDate: string, toDate: string): WorkoutLogEntry[];
  add(input: NewWorkoutLogEntry): WorkoutLogEntry;
  update(entry: WorkoutLogEntry): WorkoutLogEntry;
  remove(id: string): void;
  /**
   * Dépense cardio estimée du jour. La musculation n'est pas comptabilisée en
   * V1 : elle vise la composition corporelle, pas la dépense.
   */
  getEstimatedKcalForDate(date: string): number;
}

export function createWorkoutRepository(context: RepositoryContext): WorkoutRepository {
  const { db, generateId, now } = context;

  function persist(entry: WorkoutLogEntry): WorkoutLogEntry {
    const at = now();
    const values = toWorkoutLogEntryInsert(entry);

    db.transaction((tx) => {
      tx.insert(workoutLogEntry)
        .values(values)
        .onConflictDoUpdate({ target: workoutLogEntry.id, set: values })
        .run();

      markDirty(tx, 'workout_log_entry', entry.id, at);
    });

    return entry;
  }

  function selectByDate(date: string): WorkoutLogEntry[] {
    return db
      .select()
      .from(workoutLogEntry)
      .where(eq(workoutLogEntry.date, date))
      .all()
      .map(toWorkoutLogEntry);
  }

  return {
    getById(id) {
      const row = db.select().from(workoutLogEntry).where(eq(workoutLogEntry.id, id)).get();
      return row ? toWorkoutLogEntry(row) : undefined;
    },

    getByDate: selectByDate,

    getByDateRange(fromDate, toDate) {
      return db
        .select()
        .from(workoutLogEntry)
        .where(between(workoutLogEntry.date, fromDate, toDate))
        .orderBy(asc(workoutLogEntry.date))
        .all()
        .map(toWorkoutLogEntry);
    },

    add(input) {
      return persist({ ...input, id: generateId() });
    },

    update(entry) {
      return persist(entry);
    },

    remove(id) {
      const at = now();

      db.transaction((tx) => {
        tx.delete(workoutLogEntry).where(eq(workoutLogEntry.id, id)).run();
        markDeleted(tx, 'workout_log_entry', id, at);
      });
    },

    getEstimatedKcalForDate(date) {
      return selectByDate(date).reduce(
        (total, entry) => total + (entry.estimatedKcalBurned ?? 0),
        0,
      );
    },
  };
}
