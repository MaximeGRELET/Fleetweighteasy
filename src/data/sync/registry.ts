import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  consent,
  foodItem,
  foodLogEntry,
  goalChangeEvent,
  meal,
  profile,
  type SyncEntityType,
  weightEntry,
  workoutLogEntry,
} from '@/data/db/schema';

/**
 * Correspondance entre un type d'entité synchronisé et sa table locale.
 *
 * Typée sur `SyncEntityType` : ajouter un type à `SYNC_ENTITY_TYPES` sans
 * l'inscrire ici est une erreur de compilation, pas une donnée qui cesserait
 * silencieusement de se synchroniser.
 */
export interface SyncedTable {
  table: SQLiteTable;
  /** Clé primaire. Toutes les tables synchronisées la nomment `id`. */
  idColumn: SQLiteColumn;
  /** `sync_meta.entity_id` est toujours du texte ; la clé, pas toujours. */
  toKey: (entityId: string) => string | number;
}

const textKey = (entityId: string) => entityId;
const integerKey = (entityId: string) => Number(entityId);

export const SYNCED_TABLES: Record<SyncEntityType, SyncedTable> = {
  profile: { table: profile, idColumn: profile.id, toKey: integerKey },
  consent: { table: consent, idColumn: consent.id, toKey: integerKey },
  goal_change_event: { table: goalChangeEvent, idColumn: goalChangeEvent.id, toKey: textKey },
  food_item: { table: foodItem, idColumn: foodItem.id, toKey: textKey },
  meal: { table: meal, idColumn: meal.id, toKey: textKey },
  food_log_entry: { table: foodLogEntry, idColumn: foodLogEntry.id, toKey: textKey },
  weight_entry: { table: weightEntry, idColumn: weightEntry.id, toKey: textKey },
  workout_log_entry: { table: workoutLogEntry, idColumn: workoutLogEntry.id, toKey: textKey },
};

/**
 * Ordre d'application des versions reçues : les parents avant les enfants.
 *
 * `food_log_entry` référence `food_item` et `meal` par clé étrangère. Tiré
 * avant son aliment, une entrée du journal échouerait à l'insertion.
 */
export const APPLY_ORDER: readonly SyncEntityType[] = [
  'profile',
  'consent',
  'goal_change_event',
  'food_item',
  'meal',
  'food_log_entry',
  'weight_entry',
  'workout_log_entry',
];
